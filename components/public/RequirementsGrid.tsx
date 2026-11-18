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
            <div className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-ash-divider bg-white p-4 shadow-card transition-all duration-300 sm:flex-col sm:rounded-[28px] sm:p-6 sm:hover:-translate-y-1 sm:hover:shadow-elevated">
              <div
                className={cn(
                  'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:mb-5 sm:mt-0 sm:inline-flex sm:h-12 sm:w-12 sm:rounded-full',
                  item.chargeable ? 'bg-peach-wash/80' : 'bg-sky-wash/80'
                )}
              >
                <Icon className="h-4 w-4 text-portrait-ink sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-2">
                <h3 className="text-[15px] font-medium text-portrait-ink sm:text-lg">
                  {item.title}
                </h3>
                <p className="text-sm leading-5 text-slate-helper sm:leading-6">
                  {item.description}
                </p>
                <div className="mt-3 hidden rounded-[20px] bg-[#f8fafc] px-4 py-3 text-sm text-portrait-ink opacity-70 transition-all duration-300 group-hover:opacity-100 sm:mt-5 sm:block">
                  {item.helper}
                </div>
              </div>
            </div>
          </MotionReveal>
        );
      })}
    </div>
  );
}
