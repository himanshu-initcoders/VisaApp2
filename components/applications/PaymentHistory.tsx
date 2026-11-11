'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  getStatusVariant,
} from '@/components/ui';
import { RefundPaymentDialog } from '@/components/admin/RefundPaymentDialog';
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

function remainingForCharge(
  charge: ApplicationPaymentItem,
  all: ApplicationPaymentItem[]
): number {
  const used = all
    .filter(
      (row) =>
        row.kind === 'refund' &&
        row.parentPaymentId === charge.id &&
        (row.status === 'proceed' || row.status === 'refunded')
    )
    .reduce((sum, row) => sum + row.amount, 0);
  return Math.max(0, charge.amount - used);
}

export function PaymentHistory({
  payments,
  hideTitle = false,
  canRefund = false,
  applicationId,
  onRefundSuccess,
}: {
  payments: ApplicationPaymentItem[];
  hideTitle?: boolean;
  /** Admin-only: show Refund on completed charges with remaining balance. */
  canRefund?: boolean;
  applicationId?: string;
  onRefundSuccess?: () => void;
}) {
  const [refundTarget, setRefundTarget] = useState<{
    parentPaymentId: string;
    originalAmountPaise: number;
    remainingAmountPaise: number;
  } | null>(null);

  const remainingByChargeId = useMemo(() => {
    const map = new Map<string, number>();
    for (const payment of payments) {
      const isCharge =
        payment.status === 'completed' &&
        (payment.kind == null || payment.kind === 'charge');
      if (!isCharge) continue;
      map.set(payment.id, remainingForCharge(payment, payments));
    }
    return map;
  }, [payments]);

  return (
    <>
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
              {payments.map((payment) => {
                const isRefund = payment.kind === 'refund';
                const isCharge =
                  payment.status === 'completed' &&
                  (payment.kind == null || payment.kind === 'charge');
                const remaining = remainingByChargeId.get(payment.id) ?? 0;
                const showRefundButton =
                  canRefund &&
                  Boolean(applicationId) &&
                  isCharge &&
                  Boolean(payment.razorpayPaymentId) &&
                  remaining > 0;

                return (
                  <li
                    key={payment.id}
                    className="rounded-2xl border border-ash px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-switzer text-sm font-medium text-portrait-ink">
                          {isRefund ? 'Refund · ' : ''}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getStatusVariant(payment.status)}>
                          {payment.status}
                        </Badge>
                        {showRefundButton ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRefundTarget({
                                parentPaymentId: payment.id,
                                originalAmountPaise: payment.amount,
                                remainingAmountPaise: remaining,
                              })
                            }
                          >
                            Refund
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="font-switzer text-xs text-slate-helper">
                          Date
                        </dt>
                        <dd className="font-switzer text-sm text-portrait-ink">
                          {formatWhen(payment.completedAt || payment.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-switzer text-xs text-slate-helper">
                          Method
                        </dt>
                        <dd className="font-switzer text-sm text-portrait-ink">
                          {isRefund
                            ? 'Refund'
                            : formatMethod(payment.paymentMethod)}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-switzer text-xs text-slate-helper">
                          {isRefund
                            ? 'Razorpay refund id'
                            : 'Razorpay payment id'}
                        </dt>
                        <dd className="break-all font-switzer text-sm text-portrait-ink">
                          {isRefund
                            ? payment.razorpayRefundId || '—'
                            : payment.razorpayPaymentId || '—'}
                        </dd>
                      </div>
                    </dl>
                    {payment.status === 'proceed' ? (
                      <p className="mt-3 font-switzer text-xs text-slate-helper">
                        Amount will be credited to customer&apos;s bank account
                        within 5-7 working days after the refund has processed
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {canRefund && applicationId && refundTarget ? (
        <RefundPaymentDialog
          isOpen
          onClose={() => setRefundTarget(null)}
          applicationId={applicationId}
          parentPaymentId={refundTarget.parentPaymentId}
          originalAmountPaise={refundTarget.originalAmountPaise}
          remainingAmountPaise={refundTarget.remainingAmountPaise}
          onSuccess={onRefundSuccess}
        />
      ) : null}
    </>
  );
}
