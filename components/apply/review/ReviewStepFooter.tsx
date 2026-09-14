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

  return (
    <div className="mt-6 flex flex-col items-stretch gap-3 sm:items-end">
      <p className="text-sm text-slate-helper sm:text-right">
        {canProceed
          ? skipped > 0
            ? `Checkout includes ${filledCount} filled traveller${filledCount === 1 ? '' : 's'}. ${skipped} not started will be skipped.`
            : `${filledCount} traveller${filledCount === 1 ? '' : 's'} ready for checkout.`
          : 'Fill at least one traveller to continue to checkout.'}
      </p>
      <button
        type="button"
        disabled={!canProceed}
        onClick={onProceedCheckout}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2f3b4c] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Lock className="h-3.5 w-3.5" />
        Proceed to checkout
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
