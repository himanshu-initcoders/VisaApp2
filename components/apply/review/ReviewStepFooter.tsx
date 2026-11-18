'use client';

import { ArrowRight, Lock } from 'lucide-react';

interface ReviewStepFooterProps {
  filledCount: number;
  totalCount: number;
  onProceedCheckout: () => void;
}

export function ReviewStepFooter({
  filledCount,
  totalCount,
  onProceedCheckout,
}: ReviewStepFooterProps) {
  const skipped = totalCount - filledCount;
  const canProceed = filledCount > 0;
  const statusText = canProceed
    ? skipped > 0
      ? `Checkout includes ${filledCount} filled traveller${filledCount === 1 ? '' : 's'}. ${skipped} not started will be skipped.`
      : `${filledCount} traveller${filledCount === 1 ? '' : 's'} ready for checkout.`
    : 'Fill at least one traveller to continue to checkout.';

  return (
    <>
      {/* Desktop / in-flow footer */}
      <div className="mt-6 hidden flex-col items-stretch gap-3 sm:flex sm:items-end">
        <p className="text-sm text-slate-helper sm:text-right">{statusText}</p>
        <button
          type="button"
          disabled={!canProceed}
          onClick={onProceedCheckout}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2f3b4c] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Proceed to checkout
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      </div>

      {/* Mobile fixed footer */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 sm:hidden">
        <div className="pointer-events-auto border-t border-ash-divider bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <p className="mb-2 text-center text-xs text-slate-helper">{statusText}</p>
          <button
            type="button"
            disabled={!canProceed}
            onClick={onProceedCheckout}
            className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-full bg-[#2f3b4c] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Proceed to checkout
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </>
  );
}
