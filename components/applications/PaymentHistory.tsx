import Link from 'next/link';
import { Badge, Card, CardContent, CardHeader, CardTitle, getStatusVariant } from '@/components/ui';
import { formatInrFromPaise } from '@/lib/payments/money';
import type { ApplicationPaymentItem } from '@/types/admin';

function formatWhen(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatMethod(method: string | null): string {
  if (!method) return '—';
  if (method === 'upi') return 'UPI';
  if (method === 'card') return 'Card';
  if (method === 'netbanking') return 'Net banking';
  return method;
}

export function PaymentHistory({
  payments,
  hideTitle = false,
}: {
  payments: ApplicationPaymentItem[];
  hideTitle?: boolean;
}) {
  return (
    <Card>
      {!hideTitle && (
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {payments.length === 0 ? (
          <p className="font-switzer text-sm text-slate-helper">
            No payments recorded.
          </p>
        ) : (
          <ul className="space-y-4">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="rounded-2xl border border-ash px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-switzer text-sm font-medium text-portrait-ink">
                      {formatInrFromPaise(payment.amount)}
                    </p>
                    {payment.label && (
                      <p className="mt-1 truncate font-switzer text-xs text-slate-helper">
                        {payment.href ? (
                          <Link
                            href={payment.href}
                            className="text-nautical-teal hover:text-portrait-ink"
                          >
                            {payment.label}
                          </Link>
                        ) : (
                          payment.label
                        )}
                      </p>
                    )}
                  </div>
                  <Badge variant={getStatusVariant(payment.status)}>
                    {payment.status}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-switzer text-xs text-slate-helper">Date</dt>
                    <dd className="font-switzer text-sm text-portrait-ink">
                      {formatWhen(payment.completedAt || payment.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-switzer text-xs text-slate-helper">Method</dt>
                    <dd className="font-switzer text-sm text-portrait-ink">
                      {formatMethod(payment.paymentMethod)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-switzer text-xs text-slate-helper">
                      Razorpay payment id
                    </dt>
                    <dd className="break-all font-switzer text-sm text-portrait-ink">
                      {payment.razorpayPaymentId || '—'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
