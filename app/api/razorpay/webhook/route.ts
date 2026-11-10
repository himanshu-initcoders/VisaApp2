import { NextResponse } from 'next/server';
import {
  confirmCapturedPaymentFromGateway,
  findCapturedOrAuthorizedPaymentIdForOrder,
  linkCapturedPaymentIfApplicationExists,
  markPaymentFailed,
} from '@/lib/payments/record';
import {
  markRefundFailed,
  markRefundProcessed,
} from '@/lib/payments/refund';
import {
  normalizePaise,
  verifyWebhookSignature,
} from '@/lib/payments/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WebhookPaymentEntity {
  id?: string;
  order_id?: string;
  status?: string;
  method?: string;
}

interface WebhookOrderEntity {
  id?: string;
  status?: string;
}

interface WebhookRefundEntity {
  id?: string;
  payment_id?: string;
  amount?: number | string;
  status?: string;
}

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: WebhookPaymentEntity;
    };
    order?: {
      entity?: WebhookOrderEntity;
    };
    refund?: {
      entity?: WebhookRefundEntity;
    };
  };
}

function logWebhook(fields: {
  event: string | undefined;
  orderId?: string | null;
  paymentId?: string | null;
  localPaymentId?: string | null;
  outcome: string;
  error?: string;
}) {
  console.info('razorpay_webhook', {
    event: fields.event ?? null,
    orderId: fields.orderId ?? null,
    paymentId: fields.paymentId ?? null,
    localPaymentId: fields.localPaymentId ?? null,
    outcome: fields.outcome,
    error: fields.error ?? null,
  });
}

async function confirmAndLink(input: {
  event: string;
  orderId: string;
  paymentId: string;
}) {
  const result = await confirmCapturedPaymentFromGateway({
    razorpayOrderId: input.orderId,
    razorpayPaymentId: input.paymentId,
  });

  if (!result.ok) {
    logWebhook({
      event: input.event,
      orderId: input.orderId,
      paymentId: input.paymentId,
      outcome: result.outcome,
      error: result.error,
    });
    if (result.retryable) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  await linkCapturedPaymentIfApplicationExists(result.payment);

  logWebhook({
    event: input.event,
    orderId: input.orderId,
    paymentId: input.paymentId,
    localPaymentId: result.payment.id,
    outcome: result.outcome,
  });

  return NextResponse.json({ received: true });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    logWebhook({ event: undefined, outcome: 'invalid_signature' });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event;

  try {
    if (event === 'payment.failed') {
      const entity = body.payload?.payment?.entity;
      const orderId = entity?.order_id;
      const paymentId = entity?.id;
      if (orderId) {
        await markPaymentFailed({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          method: entity?.method ?? null,
          metadata: {
            event,
            paymentId: paymentId ?? null,
            status: entity?.status ?? null,
          },
        });
        logWebhook({
          event,
          orderId,
          paymentId: paymentId ?? null,
          outcome: 'failed',
        });
      } else {
        logWebhook({ event, outcome: 'failed_missing_order' });
      }
      return NextResponse.json({ received: true });
    }

    if (event === 'payment.captured') {
      const entity = body.payload?.payment?.entity;
      const orderId = entity?.order_id;
      const paymentId = entity?.id;
      if (!orderId || !paymentId) {
        logWebhook({
          event,
          orderId: orderId ?? null,
          paymentId: paymentId ?? null,
          outcome: 'rejected',
          error: 'Missing order_id or payment id.',
        });
        return NextResponse.json({ received: true });
      }
      return await confirmAndLink({ event, orderId, paymentId });
    }

    if (event === 'order.paid') {
      const orderId = body.payload?.order?.entity?.id;
      if (!orderId) {
        logWebhook({
          event,
          outcome: 'rejected',
          error: 'Missing order id.',
        });
        return NextResponse.json({ received: true });
      }

      const listed = await findCapturedOrAuthorizedPaymentIdForOrder(orderId);
      if (!listed.ok) {
        logWebhook({
          event,
          orderId,
          outcome: listed.retryable ? 'gateway_error' : 'rejected',
          error: listed.error,
        });
        if (listed.retryable) {
          return NextResponse.json({ error: listed.error }, { status: 500 });
        }
        return NextResponse.json({ received: true });
      }

      return await confirmAndLink({
        event,
        orderId,
        paymentId: listed.paymentId,
      });
    }

    if (event === 'refund.processed') {
      const entity = body.payload?.refund?.entity;
      const refundId = entity?.id;
      if (!refundId) {
        logWebhook({
          event,
          outcome: 'rejected',
          error: 'Missing refund id.',
        });
        return NextResponse.json({ received: true });
      }
      const amountPaise = normalizePaise(entity?.amount);
      const result = await markRefundProcessed({
        razorpayRefundId: refundId,
        amountPaise,
        razorpayPaymentId: entity?.payment_id ?? null,
      });
      if (!result.ok) {
        logWebhook({
          event,
          paymentId: entity?.payment_id ?? null,
          outcome: result.outcome,
          error: result.error,
        });
        if (result.retryable) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ received: true });
      }
      logWebhook({
        event,
        paymentId: entity?.payment_id ?? null,
        localPaymentId: result.payment.id,
        outcome: result.outcome,
      });
      return NextResponse.json({ received: true });
    }

    if (event === 'refund.failed') {
      const entity = body.payload?.refund?.entity;
      const amountPaise = normalizePaise(entity?.amount);
      const result = await markRefundFailed({
        razorpayRefundId: entity?.id ?? null,
        razorpayPaymentId: entity?.payment_id ?? null,
        amountPaise,
      });
      if (!result.ok) {
        logWebhook({
          event,
          paymentId: entity?.payment_id ?? null,
          outcome: result.outcome,
          error: result.error,
        });
        if (result.retryable) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ received: true });
      }
      logWebhook({
        event,
        paymentId: entity?.payment_id ?? null,
        localPaymentId: result.payment.id,
        outcome: 'failed',
      });
      return NextResponse.json({ received: true });
    }

    logWebhook({ event, outcome: 'ignored' });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('razorpay webhook error:', error);
    logWebhook({
      event,
      outcome: 'gateway_error',
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
