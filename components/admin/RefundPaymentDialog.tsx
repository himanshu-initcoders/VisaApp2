'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { initiateVisaRefund } from '@/app/(admin)/actions';
import { formatInrFromPaise } from '@/lib/payments/money';
import { cn } from '@/lib/utils';

export interface RefundPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  parentPaymentId: string;
  originalAmountPaise: number;
  remainingAmountPaise: number;
  onSuccess?: () => void;
}

function paiseFromRupeeInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return null;
  const [whole, frac = ''] = raw.split('.');
  const rupees = Number(whole);
  const paisePart = Number(frac.padEnd(2, '0').slice(0, 2) || '0');
  if (!Number.isSafeInteger(rupees) || !Number.isSafeInteger(paisePart)) {
    return null;
  }
  return rupees * 100 + paisePart;
}

export function RefundPaymentDialog({
  isOpen,
  onClose,
  applicationId,
  parentPaymentId,
  originalAmountPaise,
  remainingAmountPaise,
  onSuccess,
}: RefundPaymentDialogProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountPaise = paiseFromRupeeInput(amountRupees);
  const capError =
    amountPaise != null && amountPaise > remainingAmountPaise
      ? `Refund cannot exceed the remaining refundable amount of ${formatInrFromPaise(remainingAmountPaise)} (original ${formatInrFromPaise(originalAmountPaise)})`
      : amountPaise != null && amountPaise > originalAmountPaise
        ? `Refund cannot exceed the original amount of ${formatInrFromPaise(originalAmountPaise)}`
        : '';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAmountRupees('');
      setReason('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (amountPaise == null || amountPaise <= 0) {
      setError('Enter a valid refund amount greater than zero');
      return;
    }
    if (capError) {
      setError(capError);
      return;
    }
    if (!reason.trim()) {
      setError('Enter a reason for the refund');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await initiateVisaRefund({
        applicationId,
        parentPaymentId,
        amountPaise,
        reason: reason.trim(),
      });
      if (!result.success) {
        setError(result.message || 'Failed to initiate refund');
        return;
      }
      onSuccess?.();
      router.refresh();
      onClose();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-portrait-ink/50"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-payment-title"
          className="pointer-events-auto relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-elevated"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="refund-payment-title"
              className="font-basier text-[31px] text-portrait-ink"
            >
              Refund payment
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-helper transition-colors hover:text-portrait-ink"
              aria-label="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="refund-amount"
                className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Refund amount (₹) <span className="text-red-600">*</span>
              </label>
              <input
                id="refund-amount"
                type="text"
                inputMode="decimal"
                value={amountRupees}
                disabled={isSubmitting}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="Enter amount"
                className={cn(
                  'w-full font-switzer text-sm text-portrait-ink',
                  'rounded-[16px] border border-ash bg-white',
                  'px-4 py-3',
                  'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              />
              <p className="mt-1 font-switzer text-xs text-slate-helper">
                Original {formatInrFromPaise(originalAmountPaise)} · Remaining{' '}
                {formatInrFromPaise(remainingAmountPaise)}
              </p>
              {capError ? (
                <p className="mt-1 font-switzer text-sm text-red-600">{capError}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="refund-reason"
                className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Reason for returning <span className="text-red-600">*</span>
              </label>
              <textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this amount being refunded?"
                rows={4}
                maxLength={1000}
                disabled={isSubmitting}
                className={cn(
                  'w-full font-switzer text-sm text-portrait-ink',
                  'rounded-[16px] border border-ash bg-white',
                  'px-4 py-3',
                  'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'resize-none'
                )}
              />
              <p className="mt-1 font-switzer text-xs text-slate-helper">
                {reason.length}/1000 characters
              </p>
            </div>

            {error ? (
              <p className="font-switzer text-sm text-red-600">{error}</p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || Boolean(capError)}
              >
                {isSubmitting ? 'Processing…' : 'Initiate refund'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
