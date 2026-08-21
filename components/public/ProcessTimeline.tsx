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
    <>
      {/* Mobile: vertical timeline with connecting line */}
      <div className="relative space-y-0 sm:hidden">
        {steps.map((step, index) => (
          <MotionReveal key={step.id} delayMs={index * 80}>
            <div className="relative flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[21px] top-11 bottom-0 w-px bg-ash-divider" />
              )}
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-portrait-ink text-sm font-semibold text-white">
                {String(step.stepNumber).padStart(2, '0')}
              </div>
              <div className="pt-2">
                <h3 className="text-[15px] font-semibold text-portrait-ink">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-helper">
                  {step.description}
                </p>
              </div>
            </div>
          </MotionReveal>
        ))}
      </div>

      {/* Desktop: horizontal cards */}
      <div className="hidden gap-5 sm:grid lg:grid-cols-4">
        {steps.map((step, index) => (
          <MotionReveal key={step.id} delayMs={index * 80}>
            <div className="relative h-full rounded-[28px] border border-ash-divider bg-white p-6 shadow-card">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-portrait-ink text-sm font-semibold text-white">
                  {String(step.stepNumber).padStart(2, '0')}
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-portrait-ink/40 to-transparent" />
              </div>
              <h3 className="text-xl font-semibold text-portrait-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-helper">
                {step.description}
              </p>
            </div>
          </MotionReveal>
        ))}
      </div>
    </>
  );
}
