'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MobileOtpSignIn } from '@/components/auth/MobileOtpSignIn';
import { syncDraftAfterLogin } from '@/lib/apply/syncDraftAfterLogin';
import { readApplyDraft } from '@/lib/apply/draftStorage';
import {
  clearLocalDraftAfterSubmit,
  collectIdbFilesForSubmit,
} from '@/lib/apply/collectSubmitFiles';
import { submitApplication } from '@/lib/apply/submitApplication';
import {
  createVisaCheckoutOrder,
  quoteVisaCheckout,
  verifyVisaCheckout,
} from '@/lib/payments/actions';
import { formatInrFromPaise } from '@/lib/payments/money';
import { cn } from '@/lib/utils';

interface CheckoutPayStepProps {
  countryName: string;
  countryCode: string;
  listingId: string;
  filledCount: number;
  onBack: () => void;
  /** Called after a newer server draft was written to local storage. */
  onDraftRestored?: () => void;
}

interface CheckoutQuote {
  amountPaise: number;
  free: boolean;
  governmentFeePaise: number;
  serviceFeePaise: number;
  gstFeePaise: number;
  travellerCount: number;
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open: () => void;
  on: (
    event: 'payment.failed',
    handler: (response: { error?: { description?: string } }) => void
  ) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

function newSubmitId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutPayStep({
  countryName,
  countryCode,
  listingId,
  filledCount,
  onBack,
  onDraftRestored,
}: CheckoutPayStepProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthed = status === 'authenticated' && Boolean(session?.user?.id);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const submitIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;

    async function run() {
      setSyncing(true);
      const result = await syncDraftAfterLogin(listingId, countryCode);
      if (cancelled) return;
      if (result.status === 'pulled') {
        setSyncMessage(result.message);
        onDraftRestored?.();
      } else if (result.status === 'error') {
        setSyncMessage(result.message);
      } else if (result.status === 'pushed') {
        setSyncMessage('Application draft saved to your account');
      }
      setSyncing(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, listingId, countryCode, onDraftRestored]);

  useEffect(() => {
    if (!isAuthed || filledCount < 1) return;
    let cancelled = false;

    async function run() {
      setQuoting(true);
      const draft = readApplyDraft(listingId);
      const travellerCount = draft?.travellers?.length || filledCount;
      const result = await quoteVisaCheckout({
        listingId,
        priceOptionId: draft?.departure?.priceOption ?? null,
        travellerCount,
      });
      if (cancelled) return;
      if (!result.success) {
        setQuote(null);
        setError(result.error);
      } else {
        setQuote({
          amountPaise: result.amountPaise,
          free: result.free,
          governmentFeePaise: result.governmentFeePaise,
          serviceFeePaise: result.serviceFeePaise,
          gstFeePaise: result.gstFeePaise,
          travellerCount: result.travellerCount,
        });
        setError(null);
      }
      setQuoting(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, listingId, filledCount]);

  const finishSubmitted = async (applicationId: string) => {
    await clearLocalDraftAfterSubmit(listingId);
    setSuccessId(applicationId);
    setSubmitting(false);
    router.push(`/dashboard?submitted=${applicationId}`);
  };

  const handlePay = async () => {
    if (!isAuthed || submitting || successId) return;
    setError(null);
    setSubmitting(true);

    try {
      if (!submitIdRef.current) {
        submitIdRef.current = newSubmitId();
      }
      const submitId = submitIdRef.current;

      const draft = readApplyDraft(listingId);
      if (!draft || !draft.travellers?.length) {
        setError('No application draft found. Go back and complete the form.');
        setSubmitting(false);
        return;
      }

      const travellers = draft.travellers.map((t) => ({
        id: t.id,
        name: t.name,
        passportData: (t.passportData as unknown as Record<string, unknown>) ?? null,
        tripDetails: (t.tripDetails as unknown as Record<string, unknown>) ?? null,
        documents: (t.documents ?? []).map((d) => ({
          key: d.key,
          name: d.name,
          mimeType: d.mimeType,
          size: d.size,
        })),
        passportUploaded: t.passportUploaded,
        photoUploaded: t.photoUploaded,
        applicationComplete: t.applicationComplete,
      }));

      const files = await collectIdbFilesForSubmit(listingId, draft.travellers);
      const priceOptionId = draft.departure?.priceOption ?? null;

      const created = await createVisaCheckoutOrder({
        submitId,
        listingId,
        countryCode,
        priceOptionId,
        travellers,
      });

      if (!created.success) {
        setError(created.error);
        setSubmitting(false);
        return;
      }

      if (created.kind === 'already_submitted') {
        await finishSubmitted(created.applicationId);
        return;
      }

      if (created.kind === 'free') {
        const result = await submitApplication({
          submitId,
          listingId,
          countryCode,
          priceOptionId,
          travellers,
          files,
        });
        if (!result.success) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
        await finishSubmitted(result.applicationId);
        return;
      }

      if (created.kind === 'resume') {
        const result = await verifyVisaCheckout({
          submitId,
          listingId,
          countryCode,
          priceOptionId,
          travellers,
          files,
          razorpayOrderId: created.orderId,
        });
        if (!result.success) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
        await finishSubmitted(result.applicationId);
        return;
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        setError('Could not load Razorpay. Check your connection and try again.');
        setSubmitting(false);
        return;
      }

      let checkoutFinished = false;
      const razorpay = new window.Razorpay({
        key: created.keyId,
        amount: created.amount,
        currency: created.currency,
        name: 'Viserv',
        description: `Visa for ${countryName}`,
        order_id: created.orderId,
        prefill: session?.user?.phone
          ? { contact: `+91${session.user.phone}` }
          : undefined,
        theme: { color: '#08304c' },
        handler: (response: RazorpaySuccess) => {
          checkoutFinished = true;
          void (async () => {
            const result = await verifyVisaCheckout({
              submitId,
              listingId,
              countryCode,
              priceOptionId,
              travellers,
              files,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (!result.success) {
              setError(
                result.error ||
                  'Payment received, but the application was not submitted. Try again.'
              );
              setSubmitting(false);
              return;
            }
            await finishSubmitted(result.applicationId);
          })();
        },
        modal: {
          ondismiss: () => {
            if (!checkoutFinished) setSubmitting(false);
          },
        },
      });

      razorpay.on('payment.failed', (response) => {
        checkoutFinished = true;
        setError(
          response.error?.description ||
            'Payment failed. You have not been charged, or the charge did not complete.'
        );
        setSubmitting(false);
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setSubmitting(false);
    }
  };

  const totalLabel = quote ? formatInrFromPaise(quote.amountPaise) : null;
  const payLabel = !isAuthed
    ? 'Login required to pay'
    : submitting
      ? quote?.free
        ? 'Submitting…'
        : 'Processing…'
      : successId
        ? 'Submitted'
        : quoting
          ? 'Calculating fee…'
          : quote?.free
            ? 'Submit application'
            : quote
              ? `Pay ${totalLabel} & submit`
              : 'Pay & submit';

  return (
    <section className="mx-auto max-w-xl pt-8 sm:pt-12">
      <div className="text-center">
        <h1 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-helper sm:text-base">
          Payment for {filledCount} traveller
          {filledCount === 1 ? '' : 's'} to {countryName}
          {isAuthed
            ? ' — you are signed in and ready to submit.'
            : ' — sign in with your mobile to unlock payment.'}
        </p>
        {session?.user?.phone && (
          <p className="mt-2 text-xs text-slate-helper">
            Signed in as +91 {session.user.phone}
          </p>
        )}
        {syncing && (
          <p className="mt-2 text-xs text-slate-helper">Syncing draft…</p>
        )}
        {syncMessage && !syncing && (
          <p className="mt-2 text-xs text-portrait-ink">{syncMessage}</p>
        )}
      </div>

      {!isAuthed && status !== 'loading' && (
        <div className="mt-8">
          <MobileOtpSignIn
            variant="checkout-embed"
            onVerified={() => {
              setSyncMessage(null);
            }}
          />
        </div>
      )}

      <div
        className={cn(
          'relative mt-8 rounded-[24px] border border-ash bg-white p-6 text-center shadow-sm',
          !isAuthed && 'select-none'
        )}
      >
        {!isAuthed && (
          <div
            className="absolute inset-0 z-10 rounded-[24px] bg-white/70 backdrop-blur-[2px]"
            aria-hidden
          />
        )}
        {quoting && (
          <p className="text-sm text-slate-helper">Calculating fee…</p>
        )}
        {quote && totalLabel && (
          <div className="space-y-2 text-sm text-portrait-ink">
            <p className="font-basier text-3xl">{totalLabel}</p>
            <p className="text-slate-helper">
              {quote.free
                ? 'No payment is due. Submitting sends your application.'
                : `Government, service, and GST for ${quote.travellerCount} traveller${quote.travellerCount === 1 ? '' : 's'}.`}
            </p>
            {!quote.free && (
              <dl className="mx-auto mt-3 max-w-xs space-y-1 text-left text-xs text-slate-helper">
                <div className="flex justify-between gap-4">
                  <dt>Government fee</dt>
                  <dd>
                    {formatInrFromPaise(
                      quote.governmentFeePaise * quote.travellerCount
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Service fee</dt>
                  <dd>
                    {formatInrFromPaise(
                      quote.serviceFeePaise * quote.travellerCount
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>GST</dt>
                  <dd>
                    {formatInrFromPaise(quote.gstFeePaise * quote.travellerCount)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {successId && (
          <p className="mt-3 text-sm text-portrait-ink">
            Submitted. Application {successId.slice(0, 8)}…
          </p>
        )}
        <button
          type="button"
          disabled={!isAuthed || submitting || quoting || Boolean(successId) || !quote}
          className={cn(
            'mt-4 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-white transition-opacity',
            isAuthed && !submitting && quote
              ? 'bg-[#3b82f6] hover:opacity-90'
              : 'cursor-not-allowed bg-slate-helper/40'
          )}
          onClick={() => {
            void handlePay();
          }}
        >
          {payLabel}
        </button>
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full border border-portrait-ink px-6 py-3 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink hover:text-white disabled:opacity-50"
        >
          Back to review
        </button>
      </div>
    </section>
  );
}
