'use client';

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

interface ApplicationSubmittedModalProps {
  open: boolean;
  /** visa | passport — tweaks copy only */
  product?: 'visa' | 'passport';
  /** Optional short reference shown under the title */
  referenceHint?: string | null;
  onContinue: () => void;
  /** Auto-continue after this many ms (default 2800). Pass 0 to disable. */
  autoContinueMs?: number;
}

/**
 * Shown after payment confirmation / free submit succeeds, before redirect.
 */
export function ApplicationSubmittedModal({
  open,
  product = 'visa',
  referenceHint = null,
  onContinue,
  autoContinueMs = 2800,
}: ApplicationSubmittedModalProps) {
  const continuedRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!open) {
      continuedRef.current = false;
      return;
    }
    if (!autoContinueMs || autoContinueMs <= 0) return;

    const timer = window.setTimeout(() => {
      if (continuedRef.current) return;
      continuedRef.current = true;
      onContinueRef.current();
    }, autoContinueMs);

    return () => window.clearTimeout(timer);
  }, [open, autoContinueMs]);

  if (!open) return null;

  const handleContinue = () => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    onContinueRef.current();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-portrait-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-submitted-title"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-ash bg-white shadow-elevated"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 100% 0%, #d7ffe2 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, #e8f1ff 0%, transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative px-6 pb-6 pt-8 text-center sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint-wash ring-1 ring-portrait-ink/10">
            <Check
              className="h-7 w-7 text-portrait-ink"
              strokeWidth={2.5}
              aria-hidden
            />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
            {product === 'passport' ? 'Passport' : 'Visa'} application
          </p>
          <h2
            id="application-submitted-title"
            className="mt-1 font-basier text-3xl text-portrait-ink"
          >
            Application submitted
          </h2>
          <p className="mx-auto mt-3 max-w-sm font-switzer text-sm leading-6 text-slate-helper">
            We&apos;ve received your application and will update you as it moves
            through review.
          </p>
          {referenceHint ? (
            <p className="mt-3 font-switzer text-xs text-slate-helper">
              Ref · {referenceHint}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleContinue}
            className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-portrait-ink px-6 py-2.5 font-switzer text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[180px]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
