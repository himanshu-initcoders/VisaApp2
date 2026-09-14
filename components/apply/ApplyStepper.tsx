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
                      ? 'bg-[#3b82f6]'
                      : active
                        ? 'bg-gradient-to-r from-[#3b82f6] to-[#dbe4f0]'
                        : 'bg-[#dbe4f0]'
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
                      ? 'bg-[#3b82f6] text-white shadow-[0_8px_20px_rgba(59,130,246,0.28)]'
                      : 'border-[1.5px] border-[#cfd8e6] bg-white text-[#9aa7b8]'
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'max-w-[88px] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:whitespace-nowrap sm:text-[13px]',
                    active ? 'text-[#3b82f6]' : 'text-[#9aa7b8]'
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
