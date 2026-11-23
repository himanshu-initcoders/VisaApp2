'use client';

import { MotionReveal } from '@/components/public/MotionReveal';

export function ProcessTimeline({
  steps,
}: {
  steps: Array<{
    id: string;
    title: string;
    description: string;
    stepNumber: number;
  }>;
}) {
  return (
    <div className="relative sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      {steps.map((step, index) => (
        <MotionReveal
          key={step.id}
          delayMs={index * 80}
          className="pb-6 last:pb-0 sm:h-full sm:pb-0"
        >
          <div className="relative flex h-full gap-4 sm:flex-col sm:gap-0 sm:rounded-[28px] sm:border sm:border-ash-divider sm:bg-white sm:p-6 sm:shadow-card">
            {index < steps.length - 1 && (
              <div className="absolute left-[21px] top-11 bottom-0 w-px bg-ash-divider sm:hidden" />
            )}
            <div className="mb-0 flex items-center gap-3 sm:mb-6">
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-portrait-ink text-sm font-semibold text-white sm:h-11 sm:w-11">
                {String(step.stepNumber).padStart(2, '0')}
              </div>
              <div className="hidden h-px flex-1 bg-gradient-to-r from-portrait-ink/40 to-transparent sm:block" />
            </div>
            <div className="pt-2 sm:pt-0">
              <h3 className="text-[15px] font-semibold text-portrait-ink sm:text-xl">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-helper sm:mt-3 sm:leading-7">
                {step.description}
              </p>
            </div>
          </div>
        </MotionReveal>
      ))}
    </div>
  );
}
