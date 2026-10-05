import 'server-only';

import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { payments, visaApplications } from '@/lib/db/schema';
import { getRazorpay, normalizePaise } from '@/lib/payments/razorpay';

export interface CapturedGatewayPayment {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status: string;
  method: string | null;
}

function safeMetadata(payment: CapturedGatewayPayment) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amountPaise,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
  };
}

export async function fetchGatewayPayment(
  paymentId: string
): Promise<CapturedGatewayPayment | null> {
  const razorpay = getRazorpay();
  const payment = await razorpay.payments.fetch(paymentId);
  const amountPaise = normalizePaise(payment.amount);
  if (!payment.id || !payment.order_id || amountPaise == null) return null;

  let status = payment.status;
  if (status === 'authorized') {
    const captured = await razorpay.payments.capture(
      payment.id,
      amountPaise,
      'INR'
    );
    status = captured.status;
  }

  return {
    id: payment.id,
    orderId: payment.order_id,
    amountPaise,
    currency: payment.currency,
    status,
    method: payment.method ?? null,
  };
}

export async function markPaymentCaptured(input: {
  razorpayOrderId: string;
  gateway: CapturedGatewayPayment;
}) {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, input.razorpayOrderId))
    .limit(1);

  if (!row) {
    return { ok: false as const, error: 'Payment order not found.' };
  }
  if (row.currency !== 'INR' || input.gateway.currency !== 'INR') {
    return { ok: false as const, error: 'Payment currency must be INR.' };
  }
  if (input.gateway.status !== 'captured') {
    return { ok: false as const, error: 'Payment is not captured.' };
  }
  if (row.amount !== input.gateway.amountPaise) {
    return { ok: false as const, error: 'Payment amount does not match the order.' };
  }
  if (input.gateway.orderId !== row.razorpayOrderId) {
    return { ok: false as const, error: 'Payment does not match this order.' };
  }
  if (
    row.status === 'completed' &&
    row.razorpayPaymentId &&
    row.razorpayPaymentId !== input.gateway.id
  ) {
    return {
      ok: false as const,
      error: 'This order was already paid with a different payment.',
    };
  }

  if (row.status === 'completed' && row.razorpayPaymentId === input.gateway.id) {
    return { ok: true as const, payment: row };
  }

  const now = new Date();
  const [updated] = await db
    .update(payments)
    .set({
      status: 'completed',
      razorpayPaymentId: input.gateway.id,
      paymentMethod: input.gateway.method,
      transactionId: input.gateway.id,
      metadata: safeMetadata(input.gateway),
      completedAt: row.completedAt ?? now,
    })
    .where(eq(payments.id, row.id))
    .returning();

  if (!updated) {
    return { ok: false as const, error: 'Could not record the payment.' };
  }
  return { ok: true as const, payment: updated };
}

export async function linkCapturedPaymentIfApplicationExists(payment: {
  id: string;
  submitId: string | null;
}) {
  if (!payment.submitId) return;

  const [application] = await db
    .select({ id: visaApplications.id })
    .from(visaApplications)
    .where(eq(visaApplications.submitId, payment.submitId))
    .limit(1);

  if (!application) return;

  await attachPaymentsToApplication({
    applicationId: application.id,
    submitId: payment.submitId,
    paymentId: payment.id,
  });
}

export async function markPaymentFailed(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  method?: string | null;
  metadata?: unknown;
}) {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, input.razorpayOrderId))
    .limit(1);

  if (!row || row.status === 'completed') return;

  await db
    .update(payments)
    .set({
      status: 'failed',
      razorpayPaymentId: input.razorpayPaymentId || row.razorpayPaymentId,
      paymentMethod: input.method || row.paymentMethod,
      metadata: input.metadata ?? row.metadata,
    })
    .where(and(eq(payments.id, row.id), eq(payments.status, 'pending')));
}

/** Link every attempt for this submit to the application, once it exists. */
export async function attachPaymentsToApplication(input: {
  applicationId: string;
  submitId: string;
  paymentId?: string | null;
}) {
  await db
    .update(payments)
    .set({ applicationId: input.applicationId })
    .where(eq(payments.submitId, input.submitId));

  if (!input.paymentId) return;

  await db
    .update(visaApplications)
    .set({ paymentId: input.paymentId, updatedAt: new Date() })
    .where(
      and(
        eq(visaApplications.id, input.applicationId),
        eq(visaApplications.submitId, input.submitId),
        or(
          isNull(visaApplications.paymentId),
          eq(visaApplications.paymentId, input.paymentId)
        )
      )
    );
}
