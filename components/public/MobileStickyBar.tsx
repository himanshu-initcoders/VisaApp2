'use client';

import { useEffect, useState } from 'react';
import { StartApplicationCTA } from '@/components/apply/StartApplicationCTA';

interface MobileStickyBarProps {
  price: string;
  processName: string;
  countryCode: string;
  listingId: string;
}

export function MobileStickyBar({
  price,
  processName,
  countryCode,
  listingId,
}: MobileStickyBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ash bg-white px-4 pb-[env(safe-area-inset-bottom,8px)] pt-3 shadow-elevated transition-transform duration-300 sm:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-portrait-ink">
            {processName}
          </p>
          <p className="text-sm text-slate-helper">{price}</p>
        </div>
        <StartApplicationCTA
          countryCode={countryCode}
          listingId={listingId}
          label="Apply now"
          size="md"
          variant="mobile"
        />
      </div>
    </div>
  );
}
