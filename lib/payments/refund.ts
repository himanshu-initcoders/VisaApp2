import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { getRazorpay } from '@/lib/payments/razorpay';

export const OPEN_TRAVELLER_STATUSES = [
  'submitted',
  'under_review',
  'action_required',
] as const;

export function perTravellerRefundSharePaise(
  amountPaise: number,
  travellerCount: number
): number {
  const count = Math.max(1, Math.trunc(travellerCount) || 1);
  return Math.floor(Math.max(0, Math.trunc(amountPaise)) / count);
}

export function refundNotesText(amountPaise: number): string {
  const rupees = (Math.max(0, Math.trunc(amountPaise)) / 100).toLocaleString(
    'en-IN',
    { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  );
  return `A refund of ₹${rupees} will be processed in 7–10 working days.`;
}

export async function loadCompletedChargeForApplication(
  applicationId: string
): Promise<typeof payments.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.applicationId, applicationId),
        eq(payments.applicationType, 'visa'),
        eq(payments.kind, 'charge'),
        eq(payments.status, 'completed')
      )
    )
    .orderBy(sql`${payments.completedAt} desc nulls last`)
    .limit(1);
  return row ?? null;
}

export async function remainingRefundablePaise(
  parentPaymentId: string
): Promise<{
  originalPaise: number;
  remainingPaise: number;
  parent: typeof payments.$inferSelect;
} | null> {
  const [parent] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, parentPaymentId))
    .limit(1);
  if (!parent || parent.kind !== 'charge' || parent.status !== 'completed') {
    return null;
  }

  const [agg] = await db
    .select({
      used: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.parentPaymentId, parentPaymentId),
        eq(payments.kind, 'refund'),
        inArray(payments.status, ['proceed', 'refunded'])
      )
    );

  const used = Number(agg?.used ?? 0);
  return {
    originalPaise: parent.amount,
    remainingPaise: Math.max(0, parent.amount - used),
    parent,
  };
}

export async function createProceedRefundRow(input: {
  parent: typeof payments.$inferSelect;
  amountPaise: number;
  travellerIds: string[];
  initiatedBy: string;
}): Promise<typeof payments.$inferSelect> {
  // Do not copy razorpayOrderId — it is unique on charge rows.
  // Parent order/payment are linked via parentPaymentId + razorpayPaymentId.
  const [created] = await db
    .insert(payments)
    .values({
      userId: input.parent.userId,
      applicationId: input.parent.applicationId,
      applicationType: input.parent.applicationType,
      amount: input.amountPaise,
      currency: input.parent.currency || 'INR',
      status: 'proceed',
      kind: 'refund',
      parentPaymentId: input.parent.id,
      razorpayPaymentId: input.parent.razorpayPaymentId,
      submitId: input.parent.submitId,
      priceOptionId: input.parent.priceOptionId,
      travellerCount: input.parent.travellerCount,
      metadata: {
        travellerIds: input.travellerIds,
        initiatedBy: input.initiatedBy,
        parentPaymentId: input.parent.id,
        parentRazorpayOrderId: input.parent.razorpayOrderId,
        parentRazorpayPaymentId: input.parent.razorpayPaymentId,
      },
    })
    .returning();

  if (!created) {
    throw new Error('Could not create refund payment row.');
  }
  return created;
}

export async function callRazorpayRefund(input: {
  razorpayPaymentId: string;
  amountPaise: number;
  refundPaymentId: string;
  notes?: Record<string, string>;
}): Promise<
  | { ok: true; razorpayRefundId: string; raw: unknown }
  | { ok: false; error: string }
> {
  try {
    const refund = (await getRazorpay().payments.refund(
      input.razorpayPaymentId,
      {
        amount: input.amountPaise,
        speed: 'optimum',
        notes: {
          local_payment_id: input.refundPaymentId,
          ...(input.notes ?? {}),
        },
      }
    )) as { id?: string };

    if (!refund?.id) {
      return { ok: false, error: 'Razorpay did not return a refund id.' };
    }
    return { ok: true, razorpayRefundId: refund.id, raw: refund };
  } catch (error) {
    console.error('callRazorpayRefund failed:', error);
    const message =
      error instanceof Error ? error.message : 'Razorpay refund failed.';
    return { ok: false, error: message };
  }
}

export async function attachRazorpayRefundId(input: {
  refundPaymentId: string;
  razorpayRefundId: string;
  raw?: unknown;
}) {
  const [existing] = await db
    .select({ metadata: payments.metadata })
    .from(payments)
    .where(eq(payments.id, input.refundPaymentId))
    .limit(1);
  const prev =
    existing?.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const metadata = {
    ...prev,
    razorpayRefundId: input.razorpayRefundId,
    gateway: input.raw ?? null,
  };

  // Raw column names avoid stale drizzle schema bindings omitting new fields.
  await db.execute(sql`
    update payments
    set
      razorpay_refund_id = ${input.razorpayRefundId},
      transaction_id = ${input.razorpayRefundId},
      metadata = ${JSON.stringify(metadata)}::jsonb
    where id = ${input.refundPaymentId}::uuid
      and kind = 'refund'
      and status = 'proceed'
  `);

  const [updated] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, input.refundPaymentId))
    .limit(1);
  return updated ?? null;
}

export async function markLocalRefundFailed(input: {
  refundPaymentId: string;
  error: string;
}) {
  await db
    .update(payments)
    .set({
      status: 'failed',
      metadata: { error: input.error },
    })
    .where(
      and(
        eq(payments.id, input.refundPaymentId),
        eq(payments.kind, 'refund'),
        eq(payments.status, 'proceed')
      )
    );
}

export async function markRefundProcessed(input: {
  razorpayRefundId: string;
  amountPaise?: number | null;
  razorpayPaymentId?: string | null;
}): Promise<
  | { ok: true; outcome: 'refunded' | 'already_refunded'; payment: typeof payments.$inferSelect }
  | { ok: false; outcome: 'not_found' | 'rejected'; error: string; retryable: boolean }
> {
  // Use SQL identifier so lookups work even if a stale schema module
  // is missing the drizzle column binding (empty `where = $1`).
  const [byRefundId] = await db
    .select()
    .from(payments)
    .where(sql`razorpay_refund_id = ${input.razorpayRefundId}`)
    .limit(1);

  let row = byRefundId ?? null;

  if (!row && input.razorpayPaymentId && input.amountPaise != null) {
    const [fallback] = await db
      .select()
      .from(payments)
      .where(
        sql`kind = 'refund'
          and status = 'proceed'
          and razorpay_payment_id = ${input.razorpayPaymentId}
          and amount = ${input.amountPaise}`
      )
      .orderBy(sql`created_at desc`)
      .limit(1);
    row = fallback ?? null;
  }

  if (!row) {
    return {
      ok: false,
      outcome: 'not_found',
      error: 'Refund payment row not found.',
      retryable: true,
    };
  }

  if (row.status === 'refunded') {
    return { ok: true, outcome: 'already_refunded', payment: row };
  }

  if (row.status !== 'proceed' && row.status !== 'failed') {
    return {
      ok: false,
      outcome: 'rejected',
      error: `Cannot mark refund from status ${row.status}.`,
      retryable: false,
    };
  }

  if (
    input.amountPaise != null &&
    input.amountPaise !== row.amount
  ) {
    return {
      ok: false,
      outcome: 'rejected',
      error: 'Refund amount does not match the local row.',
      retryable: false,
    };
  }

  const now = new Date();
  const completedAt = row.completedAt ?? now;
  // postgres.js raw params need ISO strings for timestamps (Date objects throw).
  await db.execute(sql`
    update payments
    set
      status = 'refunded',
      razorpay_refund_id = ${input.razorpayRefundId},
      transaction_id = ${input.razorpayRefundId},
      completed_at = ${completedAt.toISOString()}::timestamp
    where id = ${row.id}::uuid
  `);

  const [updated] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, row.id))
    .limit(1);

  if (!updated) {
    return {
      ok: false,
      outcome: 'not_found',
      error: 'Could not update refund row.',
      retryable: true,
    };
  }

  return { ok: true, outcome: 'refunded', payment: updated };
}

export async function markRefundFailed(input: {
  razorpayRefundId?: string | null;
  razorpayPaymentId?: string | null;
  amountPaise?: number | null;
}): Promise<
  | { ok: true; payment: typeof payments.$inferSelect }
  | { ok: false; outcome: 'not_found' | 'rejected'; error: string; retryable: boolean }
> {
  let row: typeof payments.$inferSelect | null = null;

  if (input.razorpayRefundId) {
    const [byId] = await db
      .select()
      .from(payments)
      .where(sql`razorpay_refund_id = ${input.razorpayRefundId}`)
      .limit(1);
    row = byId ?? null;
  }

  if (!row && input.razorpayPaymentId && input.amountPaise != null) {
    const [fallback] = await db
      .select()
      .from(payments)
      .where(
        sql`kind = 'refund'
          and status = 'proceed'
          and razorpay_payment_id = ${input.razorpayPaymentId}
          and amount = ${input.amountPaise}`
      )
      .orderBy(sql`created_at desc`)
      .limit(1);
    row = fallback ?? null;
  }

  if (!row) {
    return {
      ok: false,
      outcome: 'not_found',
      error: 'Refund payment row not found.',
      retryable: true,
    };
  }

  if (row.status === 'refunded') {
    return {
      ok: false,
      outcome: 'rejected',
      error: 'Refund already completed.',
      retryable: false,
    };
  }

  if (row.status === 'failed') {
    return { ok: true, payment: row };
  }

  if (input.razorpayRefundId) {
    await db.execute(sql`
      update payments
      set status = 'failed', razorpay_refund_id = ${input.razorpayRefundId}
      where id = ${row.id}::uuid and status = 'proceed'
    `);
  } else {
    await db.execute(sql`
      update payments
      set status = 'failed'
      where id = ${row.id}::uuid and status = 'proceed'
    `);
  }

  const [updated] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, row.id))
    .limit(1);

  return { ok: true, payment: updated ?? row };
}
