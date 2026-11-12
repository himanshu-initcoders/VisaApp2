'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics/gtm';

interface PassportHubViewTrackerProps {
  listingCount: number;
  /** Lowest package total in INR, when available. */
  startingValue?: number;
}

/** Fires once when the public passport hub mounts. */
export function PassportHubViewTracker({
  listingCount,
  startingValue,
}: PassportHubViewTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent('view_passport_hub', {
      listing_count: listingCount,
      currency: 'INR',
      ...(typeof startingValue === 'number' ? { value: startingValue } : {}),
    });
  }, [listingCount, startingValue]);

  return null;
}
