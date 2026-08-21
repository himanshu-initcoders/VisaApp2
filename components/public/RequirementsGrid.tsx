'use client';

import { FileText, Plane, Briefcase, Camera, ShieldCheck } from 'lucide-react';
import { MotionReveal } from '@/components/public/MotionReveal';
import { cn } from '@/lib/utils';

const iconMap = {
  passport: FileText,
  flight_details: Plane,
  hotel_details: Briefcase,
  photo: Camera,
};

export function RequirementsGrid({
  items,
}: {
  items: Array<{
    id: string;
    key: string;
    title: string;
    description: string;
    helper: string;
    chargeable: boolean;
  }>;
}) {
  return (
    <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-5 sm:space-y-0 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon =
          iconMap[item.key as keyof typeof iconMap] || ShieldCheck;

        return (
          <MotionReveal key={item.id} delayMs={index * 60}>
            {/* Mobile: compact horizontal row */}
            <div className="group flex items-start gap-4 rounded-2xl border border-ash-divider bg-white p-4 shadow-card sm:hidden">
              <div
                className={cn(
                  'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  item.chargeable ? 'bg-peach-wash/80' : 'bg-sky-wash/80'
                )}
              >
                <Icon className="h-4 w-4 text-portrait-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-medium text-portrait-ink">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-sm leading-5 text-slate-helper">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Desktop: tall card with hover reveal */}
            <div className="group relative hidden h-full overflow-hidden rounded-[28px] border border-ash-divider bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated sm:block">
              <div
                className={cn(
                  'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full',
                  item.chargeable ? 'bg-peach-wash/80' : 'bg-sky-wash/80'
                )}
              >
                <Icon className="h-5 w-5 text-portrait-ink" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-portrait-ink">
                  {item.title}
                </h3>
                <p className="text-sm leading-6 text-slate-helper">
                  {item.description}
                </p>
              </div>
              <div className="mt-5 rounded-[20px] bg-[#f8fafc] px-4 py-3 text-sm text-portrait-ink opacity-70 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {item.helper}
              </div>
            </div>
          </MotionReveal>
        );
      })}
    </div>
  );
}
