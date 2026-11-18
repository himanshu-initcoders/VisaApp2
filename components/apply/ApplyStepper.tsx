'use client';

import { cn } from '@/lib/utils';
import type { ApplyStep } from '@/lib/apply/types';

const STEPS: { id: ApplyStep; label: string }[] = [
  { id: 'travellers', label: 'Basic Information' },
  { id: 'documents', label: 'Review' },
  { id: 'pay', label: 'Checkout' },
];

function stepIndex(step: ApplyStep) {
  return Math.max(0, STEPS.findIndex((item) => item.id === step));
}

interface ApplyStepperProps {
  step: ApplyStep;
  onSelect: (step: ApplyStep) => void;
  canOpenReview: boolean;
  canOpenCheckout: boolean;
}

export function ApplyStepper({
  step,
  onSelect,
  canOpenReview,
  canOpenCheckout,
}: ApplyStepperProps) {
  const current = stepIndex(step);

  return (
    <nav aria-label="Application progress" className="mx-auto w-full max-w-xl px-12 sm:max-w-2xl">
      <ol className="flex items-start">
        {STEPS.map((item, index) => {
          const active = index === current;
          const completed = index < current;
          const reachable =
            item.id === 'travellers' ||
            (item.id === 'documents' && canOpenReview) ||
            (item.id === 'pay' && canOpenCheckout);

          return (
            <li
              key={item.id}
              className={cn(
                'relative flex flex-1 flex-col items-center',
                index === 0 && 'flex-[0.9]',
                index === STEPS.length - 1 && 'flex-[0.9]'
              )}
            >
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[15px] h-[2px]',
                    completed
                      ? 'bg-portrait-ink'
                      : active
                        ? 'bg-gradient-to-r from-portrait-ink to-ash'
                        : 'bg-ash'
                  )}
                />
              )}

              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onSelect(item.id)}
                className="relative z-10 flex flex-col items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    active || completed
                      ? 'bg-portrait-ink text-white shadow-[0_8px_20px_rgba(8,48,76,0.22)]'
                      : 'border-[1.5px] border-fog bg-white text-slate-helper'
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'max-w-[88px] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:whitespace-nowrap sm:text-[13px]',
                    active ? 'text-portrait-ink' : 'text-slate-helper'
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
