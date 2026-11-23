'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useApplyStartFlow } from '@/components/apply/useApplyStartFlow';

interface StartApplicationCTAProps {
  countryCode: string;
  listingId: string;
  listingSlug?: string;
  travellers?: number;
  priceOptionId?: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'hero' | 'mobile';
}

export function StartApplicationCTA({
  countryCode,
  listingId,
  listingSlug,
  travellers = 1,
  priceOptionId,
  label = 'Start application',
  className,
  size = 'lg',
  variant = 'hero',
}: StartApplicationCTAProps) {
  const { requestStart, modals } = useApplyStartFlow({
    countryCode,
    listingId,
    listingSlug,
    travellers,
    priceOptionId,
  });

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={() => requestStart()}
        className={
          className ||
          (variant === 'hero'
            ? 'group flex min-w-[220px] items-center justify-center border-white bg-white text-portrait-ink hover:border-white hover:bg-white/90 hover:text-portrait-ink'
            : 'group flex shrink-0 items-center justify-center whitespace-nowrap px-6 py-3.5 text-[15px] leading-none')
        }
      >
        {label}
        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Button>
      {modals}
    </>
  );
}
