'use client';

import { cn } from '@/lib/utils';

interface FormTabFooterProps {
  continueLabel: string;
  /** Shorter label for narrow screens (e.g. "Submit" vs "Submit application"). */
  continueLabelMobile?: string;
  continueDisabled?: boolean;
  hint?: string | null;
  onContinue: () => void;
  onBack: () => void;
  backLabel?: string;
  /** When true, mobile uses a fixed bottom flex bar (desktop stays in-flow). */
  fixedOnMobile?: boolean;
}

export function FormTabFooter({
  continueLabel,
  continueLabelMobile,
  continueDisabled,
  hint,
  onContinue,
  onBack,
  backLabel = 'Back',
  fixedOnMobile = false,
}: FormTabFooterProps) {
  return (
    <div
      className={cn(
        fixedOnMobile
          ? 'fixed bottom-0 left-0 right-0 z-30 border-t border-ash-divider bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none'
          : 'mt-8'
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
          fixedOnMobile && 'mx-auto max-w-6xl'
        )}
      >
        {hint && <p className="text-xs text-[#ff4940] sm:hidden">{hint}</p>}

        {/* Desktop / non-fixed back link */}
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'text-sm text-slate-helper transition-colors hover:text-portrait-ink',
            fixedOnMobile
              ? 'order-2 hidden sm:order-1 sm:inline-flex'
              : 'order-2 sm:order-1'
          )}
        >
          {backLabel}
        </button>

        <div
          className={cn(
            'order-1 sm:order-2',
            fixedOnMobile
              ? 'flex w-full items-stretch gap-3 sm:w-auto sm:flex-col sm:items-end sm:gap-2'
              : 'flex flex-col items-stretch gap-2 sm:items-end'
          )}
        >
          {hint && (
            <p className="hidden text-xs text-[#ff4940] sm:block sm:text-right">
              {hint}
            </p>
          )}
          {fixedOnMobile && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-full border border-ash bg-white px-5 py-3 text-sm font-medium text-slate-helper transition-colors hover:text-portrait-ink sm:hidden"
            >
              {backLabel}
            </button>
          )}
          <button
            type="button"
            disabled={continueDisabled}
            onClick={onContinue}
            className={cn(
              'rounded-full bg-portrait-ink px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45',
              fixedOnMobile && 'flex-[1.4] sm:flex-none'
            )}
          >
            {continueLabelMobile ? (
              <>
                <span className="sm:hidden">{continueLabelMobile}</span>
                <span className="hidden sm:inline">{continueLabel}</span>
              </>
            ) : (
              continueLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
