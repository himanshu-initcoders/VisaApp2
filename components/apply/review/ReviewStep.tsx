'use client';

import { useEffect, useRef, useState } from 'react';
import { ReviewStepFooter } from '@/components/apply/review/ReviewStepFooter';
import { TravellerDetailPane } from '@/components/apply/review/TravellerDetailPane';
import { TravellerSidebar } from '@/components/apply/review/TravellerSidebar';
import {
  isTravellerFilled,
  isTravellerStarted,
  travellerDisplayName,
} from '@/lib/apply/reviewFields';
import type {
  ApplyDocumentSlot,
  ApplyTripQuestion,
} from '@/lib/apply/applicationForm';
import type { TravellerProfile } from '@/lib/apply/travellerProfiles';
import type { ApplyTraveller } from '@/lib/apply/types';

interface ReviewStepProps {
  countryName: string;
  travellers: ApplyTraveller[];
  canAdd: boolean;
  profiles?: TravellerProfile[];
  allProfilesAdded?: boolean;
  showEmptyProfiles?: boolean;
  selectingProfile?: boolean;
  showGeneralInfo?: boolean;
  showTripDetails?: boolean;
  extraQuestions?: ApplyTripQuestion[];
  documentSlots?: ApplyDocumentSlot[];
  onAddTraveller: (name: string) => void;
  onSelectProfile?: (profile: TravellerProfile) => void;
  onRemoveTraveller: (id: string) => void;
  onUploadPassport: (id: string, file: File) => void;
  onFillApplication: (id: string) => void;
  onEditTraveller: (id: string) => void;
  onProceedCheckout: () => void;
}

export function ReviewStep({
  countryName,
  travellers,
  canAdd,
  profiles = [],
  allProfilesAdded = false,
  showEmptyProfiles = false,
  selectingProfile = false,
  showGeneralInfo = true,
  showTripDetails = true,
  extraQuestions = [],
  documentSlots = [],
  onAddTraveller,
  onSelectProfile,
  onRemoveTraveller,
  onUploadPassport,
  onFillApplication,
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
  const selectedStarted = selected ? isTravellerStarted(selected) : false;

  return (
    <section className="mx-auto max-w-5xl pt-2 sm:pt-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <TravellerSidebar
          travellers={travellers}
          selectedId={selected?.id ?? null}
          canAdd={canAdd}
          profiles={profiles}
          allProfilesAdded={allProfilesAdded}
          showEmptyProfiles={showEmptyProfiles}
          selectingProfile={selectingProfile}
          onSelect={(id) => setSelectedId(id)}
          onAdd={onAddTraveller}
          onSelectProfile={onSelectProfile}
          onRemove={onRemoveTraveller}
        />

        {selected && (
          <TravellerDetailPane
            traveller={selected}
            name={travellerDisplayName(selected, Math.max(0, selectedIndex))}
            filled={selectedFilled}
            started={selectedStarted}
            showGeneralInfo={showGeneralInfo}
            showTripDetails={showTripDetails}
            extraQuestions={extraQuestions}
            documentSlots={documentSlots}
            onUploadPassport={(file) => onUploadPassport(selected.id, file)}
            onFillApplication={() => onFillApplication(selected.id)}
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
