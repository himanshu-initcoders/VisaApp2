'use client';

import { useEffect, useRef, useState } from 'react';
import { ReviewStepFooter } from '@/components/apply/review/ReviewStepFooter';
import { TravellerDetailPane } from '@/components/apply/review/TravellerDetailPane';
import { TravellerSidebar } from '@/components/apply/review/TravellerSidebar';
import {
  isTravellerFilled,
  travellerDisplayName,
} from '@/lib/apply/reviewFields';
import type { ApplyTraveller } from '@/lib/apply/types';

interface ReviewStepProps {
  countryName: string;
  travellers: ApplyTraveller[];
  canAdd: boolean;
  onAddTraveller: (name: string) => void;
  onRemoveTraveller: (id: string) => void;
  onUploadPassport: (id: string, file: File) => void;
  onEditTraveller: (id: string) => void;
  onProceedCheckout: () => void;
}

export function ReviewStep({
  countryName,
  travellers,
  canAdd,
  onAddTraveller,
  onRemoveTraveller,
  onUploadPassport,
  onEditTraveller,
  onProceedCheckout,
}: ReviewStepProps) {
  void countryName;
  const [selectedId, setSelectedId] = useState<string | null>(
    travellers[0]?.id ?? null
  );
  const previousCount = useRef(travellers.length);
  const filledCount = travellers.filter(isTravellerFilled).length;
  const selected =
    travellers.find((item) => item.id === selectedId) ?? travellers[0] ?? null;

  useEffect(() => {
    if (travellers.length > previousCount.current) {
      const newest = travellers[travellers.length - 1];
      setSelectedId(newest.id);
    } else if (
      selectedId &&
      !travellers.some((item) => item.id === selectedId)
    ) {
      setSelectedId(travellers[0]?.id ?? null);
    }
    previousCount.current = travellers.length;
  }, [travellers, selectedId]);

  const selectedIndex = selected
    ? travellers.findIndex((item) => item.id === selected.id)
    : 0;
  const selectedFilled = selected ? isTravellerFilled(selected) : false;

  return (
    <section className="mx-auto max-w-5xl pt-2 sm:pt-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <TravellerSidebar
          travellers={travellers}
          selectedId={selected?.id ?? null}
          canAdd={canAdd}
          onSelect={(id) => setSelectedId(id)}
          onAdd={onAddTraveller}
          onRemove={onRemoveTraveller}
        />

        {selected && (
          <TravellerDetailPane
            traveller={selected}
            name={travellerDisplayName(selected, Math.max(0, selectedIndex))}
            filled={selectedFilled}
            onUploadPassport={(file) => onUploadPassport(selected.id, file)}
            onEdit={() => onEditTraveller(selected.id)}
          />
        )}
      </div>

      <ReviewStepFooter
        filledCount={filledCount}
        totalCount={travellers.length}
        onProceedCheckout={onProceedCheckout}
      />
    </section>
  );
}
