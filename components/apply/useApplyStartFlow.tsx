'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ApplyLoginModal } from '@/components/apply/ApplyLoginModal';
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
  /** Only one mount on the listing page should consume ?startApply=1 from proxy. */
  consumeStartApplyQuery?: boolean;
}

interface PendingApplyQuery {
  travellers?: number;
  priceOptionId?: string;
  resume?: boolean;
}

const ALLOWED_APPLY_ROLES = new Set(['user', 'admin', 'reviewer']);

function canStartApply(role: string | undefined | null) {
  return Boolean(role && ALLOWED_APPLY_ROLES.has(role));
}

export function useApplyStartFlow({
  countryCode,
  listingId,
  travellers = 1,
  priceOptionId,
  consumeStartApplyQuery = false,
}: UseApplyStartFlowOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [draft, setDraft] = useState<ApplyDraft | null>(null);
  const pendingAfterLoginRef = useRef(false);
  const pendingQueryRef = useRef<PendingApplyQuery | null>(null);
  const consumedStartApplyRef = useRef(false);

  const goToApply = useCallback(
    (resume = false) => {
      const pending = pendingQueryRef.current;
      const params = new URLSearchParams();

      if (resume || pending?.resume) {
        params.set('resume', '1');
      } else {
        const count = pending?.travellers ?? travellers;
        params.set(
          'travellers',
          String(Math.min(100, Math.max(1, count)))
        );
        const price = pending?.priceOptionId || priceOptionId;
        if (price) {
          params.set('priceOption', price);
        }
      }

      pendingQueryRef.current = null;
      router.push(
        `/visa/${countryCode.toLowerCase()}/${listingId}/apply?${params.toString()}`
      );
    },
    [countryCode, listingId, priceOptionId, router, travellers]
  );

  const continueStart = useCallback(() => {
    const pending = pendingQueryRef.current;
    if (pending?.resume) {
      goToApply(true);
      return;
    }

    const existing = readApplyDraft(listingId);
    if (existing) {
      setDraft(existing);
      setChoiceOpen(true);
      return;
    }
    goToApply(false);
  }, [goToApply, listingId]);

  const requestStart = useCallback(() => {
    if (sessionStatus === 'loading') return;

    if (!canStartApply(session?.user?.role)) {
      pendingAfterLoginRef.current = true;
      setLoginOpen(true);
      return;
    }

    continueStart();
  }, [continueStart, session?.user?.role, sessionStatus]);

  const handleLoginVerified = useCallback(() => {
    setLoginOpen(false);
    // Wait for useSession to flip to authenticated before navigating to /apply
    // (proxy also requires the session cookie + allowed role).
    pendingAfterLoginRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingAfterLoginRef.current) return;
    if (sessionStatus !== 'authenticated') return;
    if (!canStartApply(session?.user?.role)) return;

    pendingAfterLoginRef.current = false;
    setLoginOpen(false);
    continueStart();
  }, [continueStart, session?.user?.role, sessionStatus]);

  // Proxy redirects unauthenticated /apply hits here with ?startApply=1 (+ apply query).
  useEffect(() => {
    if (!consumeStartApplyQuery) return;
    if (consumedStartApplyRef.current) return;
    if (searchParams.get('startApply') !== '1') return;
    if (sessionStatus === 'loading') return;

    consumedStartApplyRef.current = true;

    const travellersParam = Number.parseInt(
      searchParams.get('travellers') || '',
      10
    );
    const price = searchParams.get('priceOption') || undefined;
    const resume = searchParams.get('resume') === '1';

    pendingQueryRef.current = {
      travellers: Number.isFinite(travellersParam)
        ? Math.min(100, Math.max(1, travellersParam))
        : undefined,
      priceOptionId: price || undefined,
      resume: resume || undefined,
    };

    const next = new URLSearchParams(searchParams.toString());
    next.delete('startApply');
    next.delete('travellers');
    next.delete('priceOption');
    next.delete('resume');
    const qs = next.toString();
    router.replace(
      qs
        ? `/visa/${countryCode.toLowerCase()}/${listingId}?${qs}`
        : `/visa/${countryCode.toLowerCase()}/${listingId}`
    );

    if (canStartApply(session?.user?.role)) {
      continueStart();
      return;
    }

    pendingAfterLoginRef.current = true;
    setLoginOpen(true);
  }, [
    consumeStartApplyQuery,
    continueStart,
    countryCode,
    listingId,
    router,
    searchParams,
    session?.user?.role,
    sessionStatus,
  ]);

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

  const closeLogin = useCallback(() => {
    pendingAfterLoginRef.current = false;
    pendingQueryRef.current = null;
    setLoginOpen(false);
  }, []);

  const modals = (
    <>
      <ApplyLoginModal
        open={loginOpen}
        onClose={closeLogin}
        onVerified={handleLoginVerified}
      />
      {draft ? (
        <ResumeOrNewModal
          open={choiceOpen}
          draft={draft}
          onClose={closeChoice}
          onResume={handleResume}
          onStartNew={handleStartNew}
        />
      ) : null}
    </>
  );

  return {
    requestStart,
    modals,
    hasDraft: hasApplyDraft(listingId),
  };
}
