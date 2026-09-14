'use client';

interface FormTabFooterProps {
  continueLabel: string;
  continueDisabled?: boolean;
  hint?: string | null;
  onContinue: () => void;
  onBack: () => void;
  backLabel?: string;
}

export function FormTabFooter({
  continueLabel,
  continueDisabled,
  hint,
  onContinue,
  onBack,
  backLabel = 'Back',
}: FormTabFooterProps) {
  return (
    <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        className="order-2 text-sm text-slate-helper transition-colors hover:text-portrait-ink sm:order-1"
      >
        {backLabel}
      </button>
      <div className="order-1 flex flex-col items-stretch gap-2 sm:order-2 sm:items-end">
        {hint && (
          <p className="text-xs text-[#ff4940] sm:text-right">{hint}</p>
        )}
        <button
          type="button"
          disabled={continueDisabled}
          onClick={onContinue}
          className="rounded-full bg-[#3b82f6] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
