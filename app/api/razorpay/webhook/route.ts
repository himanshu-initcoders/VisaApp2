import { NextResponse } from 'next/server';
import {
  linkCapturedPaymentIfApplicationExists,
  markPaymentCaptured,
  markPaymentFailed,
  fetchGatewayPayment,
} from '@/lib/payments/record';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WebhookPaymentEntity {
  id?: string;
  order_id?: string;
  status?: string;
  method?: string;
}

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: WebhookPaymentEntity;
    };
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entity = body.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;

  if (body.event === 'payment.failed' && orderId) {
    await markPaymentFailed({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      method: entity?.method ?? null,
      metadata: {
        event: body.event,
        paymentId: paymentId ?? null,
        status: entity?.status ?? null,
      },
    });
    return NextResponse.json({ received: true });
  }

  if (body.event === 'payment.captured' && orderId && paymentId) {
    try {
      const gateway = await fetchGatewayPayment(paymentId);
      if (!gateway || gateway.orderId !== orderId) {
        console.error('razorpay webhook payment did not match the order');
        return NextResponse.json({ received: true });
      }

      const recorded = await markPaymentCaptured({
        razorpayOrderId: orderId,
        gateway,
      });
      if (!recorded.ok) {
        console.error('razorpay webhook capture rejected:', recorded.error);
        return NextResponse.json({ received: true });
      }

      await linkCapturedPaymentIfApplicationExists(recorded.payment);
    } catch (error) {
      console.error('razorpay webhook error:', error);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
