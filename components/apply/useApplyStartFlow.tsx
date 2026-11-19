'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ApplyLoginModal } from '@/components/apply/ApplyLoginModal';
import { ResumeOrNewModal } from '@/components/apply/ResumeOrNewModal';
import {
  clearApplyDraft,
  readApplyDraft,
  type ApplyDraft,
  type ApplyStep,
} from '@/lib/apply/draftStorage';
import {
  deleteApplicationDraft,
  getApplicationDraft,
} from '@/lib/apply/serverDraft';
import { clearVisaApplyLiveSession } from '@/lib/apply/wizardStepCursor';
import { trackEvent } from '@/lib/analytics/gtm';

interface UseApplyStartFlowOptions {
  countryCode: string;
  listingId: string;
  /** Public URL segment. Draft storage still uses listingId. */
  listingSlug?: string;
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

function serverPayloadToApplyDraft(input: {
  payload: {
    version: number;
    updatedAt: string;
    countryCode: string;
    countryName: string;
    listingId: string;
    processName: string;
    step: string;
    primaryName: string;
    travellers: unknown[];
    departure: unknown;
    travellersCount: number;
    interestedInInsurance?: boolean;
  };
  updatedAt: string;
}): ApplyDraft {
  const p = input.payload;
  const step =
    p.step === 'documents' || p.step === 'pay' || p.step === 'travellers'
      ? (p.step as ApplyStep)
      : 'travellers';
  return {
    version: 1,
    updatedAt: input.updatedAt || p.updatedAt,
    countryCode: p.countryCode,
    countryName: p.countryName,
    listingId: p.listingId,
    processName: p.processName,
    step,
    primaryName: p.primaryName || '',
    travellers: (p.travellers || []) as ApplyDraft['travellers'],
    departure: (p.departure || {}) as ApplyDraft['departure'],
    travellersCount: p.travellersCount || 1,
    interestedInInsurance: p.interestedInInsurance,
  };
}

function pickNewerDraft(
  local: ApplyDraft | null,
  remote: ApplyDraft | null
): ApplyDraft | null {
  if (local && remote) {
    const localTs = Date.parse(local.updatedAt) || 0;
    const remoteTs = Date.parse(remote.updatedAt) || 0;
    return remoteTs >= localTs ? remote : local;
  }
  return remote || local;
}

export function useApplyStartFlow({
  countryCode,
  listingId,
  listingSlug,
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
  const [checkingDraft, setCheckingDraft] = useState(false);
  const publicSegment = listingSlug || listingId;
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
        `/visa/${countryCode.toLowerCase()}/${publicSegment}/apply?${params.toString()}`
      );
    },
    [countryCode, priceOptionId, publicSegment, router, travellers]
  );

  const resolveExistingDraft = useCallback(async (): Promise<ApplyDraft | null> => {
    const local = readApplyDraft(listingId);
    let remote: ApplyDraft | null = null;

    if (sessionStatus === 'authenticated' && canStartApply(session?.user?.role)) {
      try {
        const result = await getApplicationDraft(listingId);
        if (result.success && result.draft) {
          remote = serverPayloadToApplyDraft({
            payload: result.draft.payload,
            updatedAt: result.draft.updatedAt,
          });
        }
      } catch {
        // Fall back to local only
      }
    }

    return pickNewerDraft(local, remote);
  }, [listingId, session?.user?.role, sessionStatus]);

  const continueStart = useCallback(async () => {
    const pending = pendingQueryRef.current;
    if (pending?.resume) {
      goToApply(true);
      return;
    }

    setCheckingDraft(true);
    try {
      const existing = await resolveExistingDraft();
      if (existing && Array.isArray(existing.travellers) && existing.travellers.length > 0) {
        setDraft(existing);
        setChoiceOpen(true);
        return;
      }
      clearVisaApplyLiveSession(listingId);
      goToApply(false);
    } finally {
      setCheckingDraft(false);
    }
  }, [goToApply, listingId, resolveExistingDraft]);

  const requestStart = useCallback(() => {
    if (sessionStatus === 'loading' || checkingDraft) return;

    trackEvent('visa_apply_start_click', {
      country_code: countryCode,
      listing_id: listingId,
      travellers,
      price_option_id: priceOptionId,
    });

    if (!canStartApply(session?.user?.role)) {
      pendingAfterLoginRef.current = true;
      trackEvent('visa_apply_login_prompt', {
        source: 'listing_cta',
        listing_id: listingId,
        country_code: countryCode,
      });
      setLoginOpen(true);
      return;
    }

    void continueStart();
  }, [
    checkingDraft,
    continueStart,
    countryCode,
    listingId,
    priceOptionId,
    session?.user?.role,
    sessionStatus,
    travellers,
  ]);

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
    void continueStart();
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
        ? `/visa/${countryCode.toLowerCase()}/${publicSegment}?${qs}`
        : `/visa/${countryCode.toLowerCase()}/${publicSegment}`
    );

    if (canStartApply(session?.user?.role)) {
      void continueStart();
      return;
    }

    pendingAfterLoginRef.current = true;
    trackEvent('visa_apply_login_prompt', {
      source: 'proxy_redirect',
      listing_id: listingId,
      country_code: countryCode,
    });
    setLoginOpen(true);
  }, [
    consumeStartApplyQuery,
    continueStart,
    countryCode,
    listingId,
    publicSegment,
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
    clearVisaApplyLiveSession(listingId);
    setDraft(null);
    setChoiceOpen(false);
    void (async () => {
      if (sessionStatus === 'authenticated') {
        try {
          await deleteApplicationDraft(listingId);
        } catch {
          // Local clear already done — still open a fresh apply.
        }
      }
      goToApply(false);
    })();
  }, [goToApply, listingId, sessionStatus]);

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
        analyticsContext="apply_modal"
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
    hasDraft: Boolean(draft) || choiceOpen,
    checkingDraft,
  };
}
