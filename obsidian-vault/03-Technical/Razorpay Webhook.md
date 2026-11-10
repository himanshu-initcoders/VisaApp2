# Razorpay Webhook (Phase 1 — payment confirmation)

## Purpose

Two-way money confirmation:

- **Browser** (`verifyVisaCheckout`) confirms payment **and** submits the visa application.
- **Webhook** (`POST /api/razorpay/webhook`) confirms payment only. It never calls `submitApplication`.
- Paid-but-no-app recovery: user retries Pay → `createVisaCheckoutOrder` returns `kind: 'resume'` → verify submits.

Shared money write: `confirmCapturedPaymentFromGateway` in `lib/payments/record.ts`.

## Dashboard setup

1. Razorpay Dashboard → **Account & Settings → Webhooks** (or Developers → Webhooks).
2. URL: `https://<prod-host>/api/razorpay/webhook`
3. Secret: generate one and set `RAZORPAY_WEBHOOK_SECRET` in the server env (not the API key secret).
4. Active events:
   - `payment.captured`
   - `payment.failed`
   - `order.paid` (backup confirmation path)

## Local development

`npm run dev` is not publicly reachable. To receive live Razorpay webhooks locally:

1. Start a tunnel (ngrok / Cloudflare Tunnel) to `http://localhost:3000`
2. Point the Dashboard webhook URL at `https://<tunnel>/api/razorpay/webhook`
3. Use the same webhook secret in `.env` as in the Dashboard

Without a tunnel, browser verify still works; only the webhook backup path is untested locally.

## Retry semantics

After a valid signature:

| Outcome | HTTP | Why |
|---|---|---|
| Local order not found / Razorpay fetch failure / unexpected throw | `500` | Razorpay retries (early race before `razorpay_order_id` is saved) |
| Amount / currency / status mismatch / different payment already completed | `200` | Permanent; do not retry forever |
| Unknown event | `200` | Acknowledge and ignore |
| Invalid signature / invalid JSON | `400` | Reject |

## Structured logs

Look for `razorpay_webhook` log lines with:

- `event`, `orderId`, `paymentId`, `localPaymentId`
- `outcome`: `completed` | `already_completed` | `failed` | `rejected` | `not_found` | `gateway_error` | `ignored` | `invalid_signature`
- `error` when applicable

## Manual test matrix

1. **Browser first:** pay → verify succeeds → app created → webhook arrives → one `completed` payment, same app (`already_completed` log).
2. **Webhook first (tab still open):** webhook marks `completed` → verify still submits app.
3. **Tab close:** pay, kill before verify → webhook completes → retry Pay → `resume` → app created, no second charge.
4. **Failed payment:** decline → `payment.failed` → local `failed`, not `completed`.
5. **Bad signature:** `400`.
6. **Unknown event:** `200`.

Smoke (signature / ack / retriable-500 paths, no live Razorpay charge):  
`npx tsx lib/payments/__smoke__/webhook.smoke.ts`

## Deferred (Phase 2+)

- Refund webhooks (`refund.processed`) and `refunded` status writes
- `webhook_events` dedupe table
- Cron for orphaned `completed` payments with null `applicationId`
- Auto-submit from draft on webhook

## Related code

- `app/api/razorpay/webhook/route.ts`
- `lib/payments/record.ts`
- `lib/payments/actions.ts`
- `lib/payments/razorpay.ts`
- `components/apply/CheckoutPayStep.tsx`
