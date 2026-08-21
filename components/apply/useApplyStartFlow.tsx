'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DepartureDateModal,
  type DepartureSelection,
} from '@/components/apply/DepartureDateModal';
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
  const [dateOpen, setDateOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [draft, setDraft] = useState<ApplyDraft | null>(null);

  const buildApplyUrl = useCallback(
    (selection: DepartureSelection, resume = false) => {
      const params = new URLSearchParams();
      if (resume) {
        params.set('resume', '1');
      } else {
        params.set(
          'travellers',
          String(Math.min(100, Math.max(1, travellers)))
        );
        if (selection.mode === 'fixed' && selection.departure) {
          params.set('departure', selection.departure);
          params.set('mode', 'fixed');
        } else if (selection.mode === 'flexible' && selection.month) {
          params.set('month', selection.month);
          params.set('mode', 'flexible');
        }
        if (priceOptionId) {
          params.set('priceOption', priceOptionId);
        }
      }
      return `/visa/${countryCode.toLowerCase()}/${listingId}/apply?${params.toString()}`;
    },
    [countryCode, listingId, travellers, priceOptionId]
  );

  const requestStart = useCallback(() => {
    const existing = readApplyDraft(listingId);
    if (existing) {
      setDraft(existing);
      setChoiceOpen(true);
      return;
    }
    setDateOpen(true);
  }, [listingId]);

  const handleProceed = useCallback(
    (selection: DepartureSelection) => {
      setDateOpen(false);
      router.push(buildApplyUrl(selection, false));
    },
    [buildApplyUrl, router]
  );

  const handleResume = useCallback(() => {
    setChoiceOpen(false);
    router.push(buildApplyUrl({ mode: 'fixed' }, true));
  }, [buildApplyUrl, router]);

  const handleStartNew = useCallback(() => {
    clearApplyDraft(listingId);
    setDraft(null);
    setChoiceOpen(false);
    setDateOpen(true);
  }, [listingId]);

  const closeChoice = useCallback(() => {
    setChoiceOpen(false);
  }, []);

  const closeDate = useCallback(() => {
    setDateOpen(false);
  }, []);

  const modals = (
    <>
      {draft && (
        <ResumeOrNewModal
          open={choiceOpen}
          draft={draft}
          onClose={closeChoice}
          onResume={handleResume}
          onStartNew={handleStartNew}
        />
      )}
      <DepartureDateModal
        open={dateOpen}
        onClose={closeDate}
        onProceed={handleProceed}
      />
    </>
  );

  return {
    requestStart,
    modals,
    hasDraft: hasApplyDraft(listingId),
  };
}
