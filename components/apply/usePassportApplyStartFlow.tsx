'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ApplyLoginModal } from '@/components/apply/ApplyLoginModal';
import { trackEvent } from '@/lib/analytics/gtm';
import { isPassportServiceType } from '@/lib/passport/constants';

interface UsePassportApplyStartFlowOptions {
  serviceType: 'fresh' | 'reissue';
  listingId?: string;
  priceOptionId?: string;
  value?: number;
  /** Hub page should consume ?startApply=1 from proxy redirects. */
  consumeStartApplyQuery?: boolean;
}

const ALLOWED_APPLY_ROLES = new Set(['user', 'admin', 'reviewer']);

function canStartApply(role: string | undefined | null) {
  return Boolean(role && ALLOWED_APPLY_ROLES.has(role));
}

export function usePassportApplyStartFlow({
  serviceType,
  listingId,
  priceOptionId,
  value,
  consumeStartApplyQuery = false,
}: UsePassportApplyStartFlowOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const pendingAfterLoginRef = useRef(false);
  const pendingQueryRef = useRef<{
    serviceType?: 'fresh' | 'reissue';
    priceOptionId?: string;
  } | null>(null);
  const consumedStartApplyRef = useRef(false);

  const goToApply = useCallback(() => {
    const pending = pendingQueryRef.current;
    const nextService = pending?.serviceType || serviceType;
    const nextPrice = pending?.priceOptionId || priceOptionId;
    pendingQueryRef.current = null;

    const params = new URLSearchParams();
    if (nextPrice) params.set('priceOption', nextPrice);
    const qs = params.toString();
    router.push(
      qs
        ? `/passport/${nextService}/apply?${qs}`
        : `/passport/${nextService}/apply`
    );
  }, [priceOptionId, router, serviceType]);

  const requestStart = useCallback(() => {
    if (sessionStatus === 'loading') return;

    trackEvent('passport_apply_start_click', {
      service_type: serviceType,
      listing_id: listingId,
      price_option_id: priceOptionId,
      value,
      currency: 'INR',
    });

    if (!canStartApply(session?.user?.role)) {
      pendingAfterLoginRef.current = true;
      pendingQueryRef.current = {
        serviceType,
        priceOptionId,
      };
      trackEvent('passport_apply_login_prompt', {
        source: 'listing_cta',
        listing_id: listingId,
        service_type: serviceType,
      });
      setLoginOpen(true);
      return;
    }

    goToApply();
  }, [
    goToApply,
    listingId,
    priceOptionId,
    serviceType,
    session?.user?.role,
    sessionStatus,
    value,
  ]);

  const handleLoginVerified = useCallback(() => {
    setLoginOpen(false);
    pendingAfterLoginRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingAfterLoginRef.current) return;
    if (sessionStatus !== 'authenticated') return;
    if (!canStartApply(session?.user?.role)) return;

    pendingAfterLoginRef.current = false;
    setLoginOpen(false);
    goToApply();
  }, [goToApply, session?.user?.role, sessionStatus]);

  // Proxy redirects unauthenticated /passport/.../apply hits here with ?startApply=1.
  useEffect(() => {
    if (!consumeStartApplyQuery) return;
    if (consumedStartApplyRef.current) return;
    if (searchParams.get('startApply') !== '1') return;
    if (sessionStatus === 'loading') return;

    consumedStartApplyRef.current = true;

    const serviceParam = (searchParams.get('serviceType') || '').toLowerCase();
    const nextService = isPassportServiceType(serviceParam)
      ? serviceParam
      : serviceType;
    const price = searchParams.get('priceOption') || undefined;

    pendingQueryRef.current = {
      serviceType: nextService,
      priceOptionId: price,
    };

    const next = new URLSearchParams(searchParams.toString());
    next.delete('startApply');
    next.delete('serviceType');
    next.delete('priceOption');
    const qs = next.toString();
    router.replace(qs ? `/passport?${qs}` : '/passport');

    if (canStartApply(session?.user?.role)) {
      goToApply();
      return;
    }

    pendingAfterLoginRef.current = true;
    trackEvent('passport_apply_login_prompt', {
      source: 'proxy_redirect',
      listing_id: listingId,
      service_type: nextService,
    });
    setLoginOpen(true);
  }, [
    consumeStartApplyQuery,
    goToApply,
    listingId,
    router,
    searchParams,
    serviceType,
    session?.user?.role,
    sessionStatus,
  ]);

  const closeLogin = useCallback(() => {
    pendingAfterLoginRef.current = false;
    pendingQueryRef.current = null;
    setLoginOpen(false);
  }, []);

  const modals = (
    <ApplyLoginModal
      open={loginOpen}
      onClose={closeLogin}
      onVerified={handleLoginVerified}
      analyticsContext="apply_modal"
      productLabel="passport"
    />
  );

  return {
    requestStart,
    modals,
  };
}
