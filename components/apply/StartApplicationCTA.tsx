'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useApplyStartFlow } from '@/components/apply/useApplyStartFlow';

interface StartApplicationCTAProps {
  countryCode: string;
  listingId: string;
  travellers?: number;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'hero' | 'mobile';
}

export function StartApplicationCTA({
  countryCode,
  listingId,
  travellers = 1,
  label = 'Start application',
  className,
  size = 'lg',
  variant = 'hero',
}: StartApplicationCTAProps) {
  const { requestStart, modals } = useApplyStartFlow({
    countryCode,
    listingId,
    travellers,
  });

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={requestStart}
        className={
          className ||
          (variant === 'hero'
            ? 'group min-w-[220px] border-white bg-white text-portrait-ink hover:border-white hover:bg-white/90 hover:text-portrait-ink flex items-center justify-center'
            : 'group flex shrink-0 items-center justify-center whitespace-nowrap')
        }
      >
        {label}
        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Button>
      {modals}
    </>
  );
}
