'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResumeOrNewModal } from '@/components/apply/ResumeOrNewModal';
import {
  clearApplyDraft,
  hasApplyDraft,
  readApplyDraft,
  type ApplyDraft,
} from '@/lib/apply/draftStorage';

interface UseApplyStartFlowOptions {
  countryCode: string;
  listingId: string;
  travellers?: number;
  priceOptionId?: string;
}

export function useApplyStartFlow({
  countryCode,
  listingId,
  travellers = 1,
  priceOptionId,
}: UseApplyStartFlowOptions) {
  const router = useRouter();
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [draft, setDraft] = useState<ApplyDraft | null>(null);

  const goToApply = useCallback(
    (resume = false) => {
      const params = new URLSearchParams();
      if (resume) {
        params.set('resume', '1');
      } else {
        params.set(
          'travellers',
          String(Math.min(100, Math.max(1, travellers)))
        );
        if (priceOptionId) {
          params.set('priceOption', priceOptionId);
        }
      }

      router.push(
        `/visa/${countryCode.toLowerCase()}/${listingId}/apply?${params.toString()}`
      );
    },
    [countryCode, listingId, priceOptionId, router, travellers]
  );

  const requestStart = useCallback(() => {
    const existing = readApplyDraft(listingId);
    if (existing) {
      setDraft(existing);
      setChoiceOpen(true);
      return;
    }
    goToApply(false);
  }, [goToApply, listingId]);

  const handleResume = useCallback(() => {
    setChoiceOpen(false);
    goToApply(true);
  }, [goToApply]);

  const handleStartNew = useCallback(() => {
    clearApplyDraft(listingId);
    setDraft(null);
    setChoiceOpen(false);
    goToApply(false);
  }, [goToApply, listingId]);

  const closeChoice = useCallback(() => {
    setChoiceOpen(false);
  }, []);

  const modals = draft ? (
    <ResumeOrNewModal
      open={choiceOpen}
      draft={draft}
      onClose={closeChoice}
      onResume={handleResume}
      onStartNew={handleStartNew}
    />
  ) : null;

  return {
    requestStart,
    modals,
    hasDraft: hasApplyDraft(listingId),
  };
}
