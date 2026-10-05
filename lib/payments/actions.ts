'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import { payments, visaApplications } from '@/lib/db/schema';
import { ensureFormVersionForSubmit } from '@/lib/db/queries/formVersions';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import { submitApplication } from '@/lib/apply/submitApplication';
import {
  validateSubmitTravellers,
  type SubmitTravellerPayload,
} from '@/lib/apply/validateSubmitTravellers';
import { quoteVisaListing, type VisaFeeQuote } from '@/lib/payments/quote';
import {
  fetchGatewayPayment,
  markPaymentCaptured,
} from '@/lib/payments/record';
import {
  getRazorpay,
  normalizePaise,
  razorpayKeyId,
  verifyCheckoutSignature,
} from '@/lib/payments/razorpay';
import {
  createVisaCheckoutOrderSchema,
  quoteVisaCheckoutSchema,
  verifyVisaCheckoutSchema,
  type CreateVisaCheckoutOrderInput,
} from '@/lib/validations/payment';

export type CreateVisaCheckoutOrderResult =
  | { success: true; kind: 'free' }
  | { success: true; kind: 'already_submitted'; applicationId: string }
  | {
      success: true;
      kind: 'resume';
      paymentId: string;
      orderId: string;
    }
  | {
      success: true;
      kind: 'order';
      orderId: string;
      amount: number;
      currency: 'INR';
      keyId: string;
    }
  | { success: false; error: string };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message || 'Invalid payment request.';
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const row = current as { code?: string; message?: string; cause?: unknown };
    if (
      row.code === '23505' ||
      (row.message ?? '').includes('payments_one_pending_per_submit')
    ) {
      return true;
    }
    current = row.cause;
  }
  return false;
}

async function requireUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: 'You must be signed in to pay.' };
  }
  const userId = await resolveSessionUserId(session.user);
  if (!userId) {
    return {
      ok: false,
      error: 'Your session is out of date. Sign out and sign in again.',
    };
  }
  return { ok: true, userId };
}

function toTravellers(
  travellers: CreateVisaCheckoutOrderInput['travellers']
): SubmitTravellerPayload[] {
  return travellers.map((traveller) => ({
    id: traveller.id,
    name: traveller.name,
    passportData:
      traveller.passportData && typeof traveller.passportData === 'object'
        ? (traveller.passportData as Record<string, unknown>)
        : null,
    tripDetails:
      traveller.tripDetails && typeof traveller.tripDetails === 'object'
        ? (traveller.tripDetails as Record<string, unknown>)
        : null,
    documents: traveller.documents,
    passportUploaded: traveller.passportUploaded,
    photoUploaded: traveller.photoUploaded,
    applicationComplete: traveller.applicationComplete,
  }));
}

async function prepareCheckout(input: {
  userId: string;
  listingId: string;
  priceOptionId?: string | null;
  travellers: SubmitTravellerPayload[];
}): Promise<{ ok: true; quote: VisaFeeQuote } | { ok: false; error: string }> {
  const formVersion = await ensureFormVersionForSubmit(
    input.listingId,
    input.userId
  );
  if (!formVersion) {
    return {
      ok: false,
      error:
        'Listing form not published. Ask an admin to open Form Builder and click Publish form version.',
    };
  }

  const validationError = validateSubmitTravellers(
    input.travellers,
    formVersion.config as ApplyFormConfig
  );
  if (validationError) return { ok: false, error: validationError };

  return quoteVisaListing({
    listingId: input.listingId,
    priceOptionId: input.priceOptionId,
    travellerCount: input.travellers.length,
  });
}

function quoteMatches(
  row: {
    amount: number;
    travellerCount: number | null;
    priceOptionId: string | null;
  },
  quote: VisaFeeQuote
): boolean {
  return (
    row.amount === quote.amountPaise &&
    row.travellerCount === quote.travellerCount &&
    row.priceOptionId === quote.priceOptionId
  );
}

async function issueRazorpayOrder(paymentId: string, input: {
  amountPaise: number;
  submitId: string;
  listingId: string;
  userId: string;
}) {
  const keyId = razorpayKeyId();
  if (!keyId) {
    return { ok: false as const, error: 'Razorpay is not configured.' };
  }

  const order = await (getRazorpay().orders.create({
    amount: input.amountPaise,
    currency: 'INR',
    receipt: paymentId,
    notes: {
      submitId: input.submitId,
      listingId: input.listingId,
      userId: input.userId,
    },
    payment: {
      capture: 'automatic',
      capture_options: {
        automatic_expiry_period: 12,
        manual_expiry_period: 7200,
        refund_speed: 'optimum',
      },
    },
  }) as Promise<{ id: string; amount: number | string; currency: string }>);

  const orderAmount = normalizePaise(order.amount);
  if (!order.id || order.currency !== 'INR' || orderAmount !== input.amountPaise) {
    return { ok: false as const, error: 'Razorpay returned an unexpected order.' };
  }

  const [updated] = await db
    .update(payments)
    .set({ razorpayOrderId: order.id })
    .where(and(eq(payments.id, paymentId), isNull(payments.razorpayOrderId)))
    .returning();

  if (updated?.razorpayOrderId) {
    return {
      ok: true as const,
      orderId: updated.razorpayOrderId,
      keyId,
      amount: input.amountPaise,
    };
  }

  const [current] = await db
    .select({ razorpayOrderId: payments.razorpayOrderId })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (current?.razorpayOrderId) {
    return {
      ok: true as const,
      orderId: current.razorpayOrderId,
      keyId,
      amount: input.amountPaise,
    };
  }

  return { ok: false as const, error: 'Could not save the Razorpay order.' };
}

async function resumeIfOrderPaid(row: {
  id: string;
  razorpayOrderId: string | null;
}): Promise<{ paymentId: string; orderId: string } | null> {
  if (!row.razorpayOrderId) return null;

  const order = (await getRazorpay().orders.fetch(row.razorpayOrderId)) as {
    status?: string;
  };
  if (order.status !== 'paid') return null;

  const listed = (await getRazorpay().orders.fetchPayments(
    row.razorpayOrderId
  )) as { items?: Array<{ id?: string; status?: string }> };
  const match = listed.items?.find(
    (item) =>
      item.id && (item.status === 'captured' || item.status === 'authorized')
  );
  if (!match?.id) return null;

  const gateway = await fetchGatewayPayment(match.id);
  if (!gateway) return null;

  const recorded = await markPaymentCaptured({
    razorpayOrderId: row.razorpayOrderId,
    gateway,
  });
  if (!recorded.ok) return null;
  return { paymentId: recorded.payment.id, orderId: row.razorpayOrderId };
}

export async function quoteVisaCheckout(input: unknown): Promise<
  | {
      success: true;
      amountPaise: number;
      currency: 'INR';
      travellerCount: number;
      free: boolean;
      governmentFeePaise: number;
      serviceFeePaise: number;
      gstFeePaise: number;
    }
  | { success: false; error: string }
> {
  const parsed = quoteVisaCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const user = await requireUserId();
  if (!user.ok) return { success: false, error: user.error };

  const quoted = await quoteVisaListing({
    listingId: parsed.data.listingId,
    priceOptionId: parsed.data.priceOptionId,
    travellerCount: parsed.data.travellerCount,
  });
  if (!quoted.ok) return { success: false, error: quoted.error };

  return {
    success: true,
    amountPaise: quoted.quote.amountPaise,
    currency: 'INR',
    travellerCount: quoted.quote.travellerCount,
    free: quoted.quote.amountPaise === 0,
    governmentFeePaise: quoted.quote.governmentFeePaise,
    serviceFeePaise: quoted.quote.serviceFeePaise,
    gstFeePaise: quoted.quote.gstFeePaise,
  };
}

export async function createVisaCheckoutOrder(
  input: unknown
): Promise<CreateVisaCheckoutOrderResult> {
  try {
    const parsed = createVisaCheckoutOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const user = await requireUserId();
    if (!user.ok) return { success: false, error: user.error };

    const [existingApp] = await db
      .select({
        id: visaApplications.id,
        userId: visaApplications.userId,
      })
      .from(visaApplications)
      .where(eq(visaApplications.submitId, parsed.data.submitId))
      .limit(1);

    if (existingApp) {
      if (existingApp.userId !== user.userId) {
        return {
          success: false,
          error: 'This submission belongs to another account.',
        };
      }
      return {
        success: true,
        kind: 'already_submitted',
        applicationId: existingApp.id,
      };
    }

    const prepared = await prepareCheckout({
      userId: user.userId,
      listingId: parsed.data.listingId,
      priceOptionId: parsed.data.priceOptionId,
      travellers: toTravellers(parsed.data.travellers),
    });
    if (!prepared.ok) return { success: false, error: prepared.error };

    if (prepared.quote.amountPaise === 0) {
      return { success: true, kind: 'free' };
    }

    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.submitId, parsed.data.submitId));

    if (rows.some((row) => row.userId !== user.userId)) {
      return {
        success: false,
        error: 'This submission belongs to another account.',
      };
    }

    const matchingCompleted = rows.find(
      (row) => row.status === 'completed' && quoteMatches(row, prepared.quote)
    );
    if (matchingCompleted?.razorpayOrderId) {
      return {
        success: true,
        kind: 'resume',
        paymentId: matchingCompleted.id,
        orderId: matchingCompleted.razorpayOrderId,
      };
    }
    if (rows.some((row) => row.status === 'completed')) {
      return {
        success: false,
        error:
          'A payment was already captured for a different fee. Contact support before paying again.',
      };
    }

    const pending = rows.find((row) => row.status === 'pending');
    if (pending && quoteMatches(pending, prepared.quote)) {
      if (pending.razorpayOrderId) {
        const resumed = await resumeIfOrderPaid(pending);
        if (resumed) {
          return { success: true, kind: 'resume', ...resumed };
        }
        const keyId = razorpayKeyId();
        if (!keyId) {
          return { success: false, error: 'Razorpay is not configured.' };
        }
        return {
          success: true,
          kind: 'order',
          orderId: pending.razorpayOrderId,
          amount: pending.amount,
          currency: 'INR',
          keyId,
        };
      }

      const issued = await issueRazorpayOrder(pending.id, {
        amountPaise: prepared.quote.amountPaise,
        submitId: parsed.data.submitId,
        listingId: parsed.data.listingId,
        userId: user.userId,
      });
      if (!issued.ok) return { success: false, error: issued.error };
      return {
        success: true,
        kind: 'order',
        orderId: issued.orderId,
        amount: issued.amount,
        currency: 'INR',
        keyId: issued.keyId,
      };
    }

    if (pending) {
      await db
        .update(payments)
        .set({ status: 'failed', metadata: { reason: 'superseded' } })
        .where(and(eq(payments.id, pending.id), eq(payments.status, 'pending')));
    }

    const created = await insertPendingPayment({
      userId: user.userId,
      submitId: parsed.data.submitId,
      quote: prepared.quote,
    });
    if (!created.ok) return { success: false, error: created.error };

    if (created.reusedOrderId) {
      const keyId = razorpayKeyId();
      if (!keyId) return { success: false, error: 'Razorpay is not configured.' };
      return {
        success: true,
        kind: 'order',
        orderId: created.reusedOrderId,
        amount: prepared.quote.amountPaise,
        currency: 'INR',
        keyId,
      };
    }

    const issued = await issueRazorpayOrder(created.paymentId, {
      amountPaise: prepared.quote.amountPaise,
      submitId: parsed.data.submitId,
      listingId: parsed.data.listingId,
      userId: user.userId,
    });
    if (!issued.ok) {
      await db
        .update(payments)
        .set({ status: 'failed', metadata: { reason: 'order_create_failed' } })
        .where(
          and(eq(payments.id, created.paymentId), eq(payments.status, 'pending'))
        );
      return { success: false, error: issued.error };
    }

    return {
      success: true,
      kind: 'order',
      orderId: issued.orderId,
      amount: issued.amount,
      currency: 'INR',
      keyId: issued.keyId,
    };
  } catch (error) {
    console.error('createVisaCheckoutOrder error:', error);
    const message = error instanceof Error ? error.message : '';
    return {
      success: false,
      error:
        message === 'Razorpay is not configured.'
          ? message
          : 'Could not start payment. Try again.',
    };
  }
}

async function insertPendingPayment(input: {
  userId: string;
  submitId: string;
  quote: VisaFeeQuote;
}): Promise<
  | { ok: true; paymentId: string; reusedOrderId?: string }
  | { ok: false; error: string }
> {
  try {
    const [created] = await db
      .insert(payments)
      .values({
        userId: input.userId,
        applicationType: 'visa',
        amount: input.quote.amountPaise,
        currency: 'INR',
        status: 'pending',
        submitId: input.submitId,
        priceOptionId: input.quote.priceOptionId,
        governmentFeePaise: input.quote.governmentFeePaise,
        serviceFeePaise: input.quote.serviceFeePaise,
        gstFeePaise: input.quote.gstFeePaise,
        travellerCount: input.quote.travellerCount,
      })
      .returning({ id: payments.id });

    if (!created) return { ok: false, error: 'Could not start payment.' };
    return { ok: true, paymentId: created.id };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const [pending] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.submitId, input.submitId),
          eq(payments.status, 'pending'),
          eq(payments.userId, input.userId)
        )
      )
      .limit(1);

    if (!pending || !quoteMatches(pending, input.quote)) {
      return {
        ok: false,
        error: 'Payment is being prepared. Try again in a moment.',
      };
    }
    if (!pending.razorpayOrderId) {
      return { ok: true, paymentId: pending.id };
    }
    return {
      ok: true,
      paymentId: pending.id,
      reusedOrderId: pending.razorpayOrderId,
    };
  }
}

export async function verifyVisaCheckout(
  input: unknown
): Promise<
  | { success: true; applicationId: string; alreadySubmitted?: boolean }
  | { success: false; error: string }
> {
  try {
    const parsed = verifyVisaCheckoutSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: firstIssue(parsed.error) };
    }

    const user = await requireUserId();
    if (!user.ok) return { success: false, error: user.error };

    const travellers = toTravellers(parsed.data.travellers);
    const prepared = await prepareCheckout({
      userId: user.userId,
      listingId: parsed.data.listingId,
      priceOptionId: parsed.data.priceOptionId,
      travellers,
    });
    if (!prepared.ok) return { success: false, error: prepared.error };
    if (prepared.quote.amountPaise === 0) {
      return { success: false, error: 'No payment is due for this application.' };
    }

    const rows = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.submitId, parsed.data.submitId),
          eq(payments.userId, user.userId)
        )
      );

    const row = parsed.data.razorpayOrderId
      ? rows.find((item) => item.razorpayOrderId === parsed.data.razorpayOrderId)
      : rows.find(
          (item) =>
            item.status === 'completed' && quoteMatches(item, prepared.quote)
        );

    if (!row?.razorpayOrderId) {
      return { success: false, error: 'Payment order not found.' };
    }
    if (!quoteMatches(row, prepared.quote)) {
      return {
        success: false,
        error: 'Payment amount does not match the current fee.',
      };
    }

    if (row.status === 'pending') {
      if (
        !parsed.data.razorpayPaymentId ||
        !parsed.data.razorpaySignature ||
        parsed.data.razorpayOrderId !== row.razorpayOrderId
      ) {
        return { success: false, error: 'Payment confirmation is incomplete.' };
      }
      const signatureOk = verifyCheckoutSignature({
        orderId: row.razorpayOrderId,
        paymentId: parsed.data.razorpayPaymentId,
        signature: parsed.data.razorpaySignature,
      });
      if (!signatureOk) {
        return { success: false, error: 'Payment signature is invalid.' };
      }
    } else if (row.status !== 'completed') {
      return { success: false, error: 'Payment was not completed.' };
    } else if (
      parsed.data.razorpayPaymentId &&
      row.razorpayPaymentId &&
      parsed.data.razorpayPaymentId !== row.razorpayPaymentId
    ) {
      return { success: false, error: 'Payment does not match this order.' };
    }

    const gatewayPaymentId =
      parsed.data.razorpayPaymentId || row.razorpayPaymentId;
    if (!gatewayPaymentId) {
      return { success: false, error: 'Payment confirmation is incomplete.' };
    }

    const gateway = await fetchGatewayPayment(gatewayPaymentId);
    if (!gateway) {
      return { success: false, error: 'Could not confirm the payment with Razorpay.' };
    }

    const recorded = await markPaymentCaptured({
      razorpayOrderId: row.razorpayOrderId,
      gateway,
    });
    if (!recorded.ok) return { success: false, error: recorded.error };

    const submitted = await submitApplication({
      submitId: parsed.data.submitId,
      listingId: parsed.data.listingId,
      countryCode: parsed.data.countryCode,
      priceOptionId: prepared.quote.priceOptionId,
      paymentId: recorded.payment.id,
      travellers,
      files: parsed.data.files ?? [],
    });

    if (!submitted.success) {
      return {
        success: false,
        error: submitted.error || 'Payment received, but the application was not submitted. Try again.',
      };
    }

    return {
      success: true,
      applicationId: submitted.applicationId,
      alreadySubmitted: submitted.alreadySubmitted,
    };
  } catch (error) {
    console.error('verifyVisaCheckout error:', error);
    const message = error instanceof Error ? error.message : '';
    return {
      success: false,
      error:
        message === 'Razorpay is not configured.'
          ? message
          : 'Could not confirm payment. Try again.',
    };
  }
}
