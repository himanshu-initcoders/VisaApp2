'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MobileOtpSignIn } from '@/components/auth/MobileOtpSignIn';
import { readApplyDraftAsync } from '@/lib/apply/draftStorage';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
import { clearLocalDraftAfterSubmit } from '@/lib/apply/collectSubmitFiles';
import { prepareDraftFilesForSubmit } from '@/lib/apply/syncDraftFiles';
import { deleteApplicationDraft } from '@/lib/apply/serverDraft';
import { submitApplication } from '@/lib/apply/submitApplication';
import {
  createVisaCheckoutOrder,
  quoteVisaCheckout,
  verifyVisaCheckout,
} from '@/lib/payments/actions';
import { formatInrFromPaise } from '@/lib/payments/money';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/Checkbox';

interface CheckoutPayStepProps {
  countryName: string;
  countryCode: string;
  listingId: string;
  filledCount: number;
  showInsuranceInterest?: boolean;
  interestedInInsurance?: boolean;
  onInterestedInInsuranceChange?: (value: boolean) => void;
  draftScope: DraftScopeInput;
  onBack: () => void;
  /** Called when submit begins (locks wizard autosave). */
  onSubmitting?: () => void;
  /** Called after a successful submit. */
  onSubmitSuccess?: () => void;
  /** Re-enable wizard autosave if payment/submit fails. */
  onSubmitFailed?: () => void;
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
  showInsuranceInterest = false,
  interestedInInsurance = false,
  onInterestedInInsuranceChange,
  draftScope,
  onBack,
  onSubmitting,
  onSubmitSuccess,
  onSubmitFailed,
}: CheckoutPayStepProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthed = status === 'authenticated' && Boolean(session?.user?.id);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const submitIdRef = useRef<string | null>(null);
  const [insuranceChecked, setInsuranceChecked] = useState(interestedInInsurance);
  const lastEmittedInsuranceRef = useRef(interestedInInsurance);

  const insuranceInterest =
    showInsuranceInterest && insuranceChecked === true;

  const handleInsuranceChange = (checked: boolean) => {
    lastEmittedInsuranceRef.current = checked;
    setInsuranceChecked(checked);
    onInterestedInInsuranceChange?.(checked);
  };

  useEffect(() => {
    if (interestedInInsurance === lastEmittedInsuranceRef.current) return;
    lastEmittedInsuranceRef.current = interestedInInsurance;
    setInsuranceChecked(interestedInInsurance);
  }, [interestedInInsurance]);

  useEffect(() => {
    if (!isAuthed || filledCount < 1) return;
    let cancelled = false;

    async function run() {
      setQuoting(true);
      const draft = await readApplyDraftAsync(draftScope);
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
    // draftScope identity fields — avoid object-identity loops
  }, [
    isAuthed,
    listingId,
    filledCount,
    draftScope.listingId,
    draftScope.sessionUserId,
    draftScope.onBehalfOfUserId,
  ]);

  const releaseSubmit = () => {
    onSubmitFailed?.();
  };

  const finishSubmitted = async (applicationId: string) => {
    onSubmitSuccess?.();
    try {
      await deleteApplicationDraft(listingId);
    } catch {
      // server submit already deletes; ignore
    }
    await clearLocalDraftAfterSubmit(draftScope);
    setSuccessId(applicationId);
    setSubmitting(false);
    router.push(`/dashboard?submitted=${applicationId}`);
  };

  const handlePay = async () => {
    if (!isAuthed || submitting || successId) return;
    setError(null);
    setUploadStatus('Uploading documents…');
    setSubmitting(true);
    onSubmitting?.();

    try {
      if (!submitIdRef.current) {
        submitIdRef.current = newSubmitId();
      }
      const submitId = submitIdRef.current;

      const draft = await readApplyDraftAsync(draftScope);
      if (!draft || !draft.travellers?.length) {
        setError('No application draft found. Go back and complete the form.');
        setUploadStatus(null);
        setSubmitting(false);
        releaseSubmit();
        return;
      }

      // FormData sync first — Server Actions receive storage keys only (no base64).
      const prepared = await prepareDraftFilesForSubmit({
        draft,
        draftScope,
        countryCode,
      });
      if (!prepared.success) {
        setError(prepared.error);
        setUploadStatus(null);
        setSubmitting(false);
        releaseSubmit();
        return;
      }

      setUploadStatus(
        prepared.uploadedCount > 0
          ? `Uploaded ${prepared.uploadedCount} file${prepared.uploadedCount === 1 ? '' : 's'}…`
          : null
      );

      const travellers = prepared.travellers.map((t) => ({
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

      const draftStorageKeys = prepared.draftStorageKeys;
      const priceOptionId = draft.departure?.priceOption ?? null;

      const created = await createVisaCheckoutOrder({
        submitId,
        listingId,
        countryCode,
        priceOptionId,
        travellers,
        interestedInInsurance: insuranceInterest,
      });

      if (!created.success) {
        setError(created.error);
        setUploadStatus(null);
        setSubmitting(false);
        releaseSubmit();
        return;
      }

      if (created.kind === 'already_submitted') {
        setUploadStatus(null);
        await finishSubmitted(created.applicationId);
        return;
      }

      if (created.kind === 'free') {
        setUploadStatus('Submitting…');
        const result = await submitApplication({
          submitId,
          listingId,
          countryCode,
          priceOptionId,
          travellers,
          draftStorageKeys,
          interestedInInsurance: insuranceInterest,
        });
        if (!result.success) {
          setError(result.error);
          setUploadStatus(null);
          setSubmitting(false);
          releaseSubmit();
          return;
        }
        setUploadStatus(null);
        await finishSubmitted(result.applicationId);
        return;
      }

      if (created.kind === 'resume') {
        setUploadStatus('Confirming payment…');
        const result = await verifyVisaCheckout({
          submitId,
          listingId,
          countryCode,
          priceOptionId,
          travellers,
          draftStorageKeys,
          interestedInInsurance: insuranceInterest,
          razorpayOrderId: created.orderId,
        });
        if (!result.success) {
          setError(result.error);
          setUploadStatus(null);
          setSubmitting(false);
          releaseSubmit();
          return;
        }
        setUploadStatus(null);
        await finishSubmitted(result.applicationId);
        return;
      }

      setUploadStatus(null);
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        setError('Could not load Razorpay. Check your connection and try again.');
        setSubmitting(false);
        releaseSubmit();
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
            setUploadStatus('Confirming payment…');
            const result = await verifyVisaCheckout({
              submitId,
              listingId,
              countryCode,
              priceOptionId,
              travellers,
              draftStorageKeys,
              interestedInInsurance: insuranceInterest,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (!result.success) {
              setError(
                result.error ||
                  'Payment received, but the application was not submitted. Try again.'
              );
              setUploadStatus(null);
              setSubmitting(false);
              releaseSubmit();
              return;
            }
            setUploadStatus(null);
            await finishSubmitted(result.applicationId);
          })();
        },
        modal: {
          ondismiss: () => {
            if (!checkoutFinished) {
              setUploadStatus(null);
              setSubmitting(false);
              releaseSubmit();
            }
          },
        },
      });

      razorpay.on('payment.failed', (response) => {
        checkoutFinished = true;
        releaseSubmit();
        setError(
          response.error?.description ||
            'Payment failed. You have not been charged, or the charge did not complete.'
        );
        setUploadStatus(null);
        setSubmitting(false);
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setUploadStatus(null);
      setSubmitting(false);
      releaseSubmit();
    }
  };

  const totalLabel = quote ? formatInrFromPaise(quote.amountPaise) : null;
  const payLabel = !isAuthed
    ? 'Login required to pay'
    : submitting
      ? uploadStatus || (quote?.free ? 'Submitting…' : 'Processing…')
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
      </div>

      {!isAuthed && status !== 'loading' && (
        <div className="mt-8">
          <MobileOtpSignIn variant="checkout-embed" />
        </div>
      )}

      {showInsuranceInterest && (
        <div className="mt-8 rounded-[24px] border border-ash bg-white p-5 text-left shadow-sm">
          <Checkbox
            label="Are you looking for visa insurance also?"
            description="Optional — tell us if you are interested in travel insurance for this trip."
            checked={insuranceChecked}
            disabled={submitting || Boolean(successId)}
            onChange={handleInsuranceChange}
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
            className="absolute inset-0 z-10 rounded-[24px] bg-white/55 backdrop-blur-[1px]"
            aria-hidden
          />
        )}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-helper">
          Total
        </p>
        <p className="mt-2 font-basier text-4xl text-portrait-ink">
          {quoting || !quote ? '—' : totalLabel}
        </p>
        {quote && !quote.free && (
          <p className="mt-2 text-xs text-slate-helper">
            Govt {formatInrFromPaise(quote.governmentFeePaise)} · Service{' '}
            {formatInrFromPaise(quote.serviceFeePaise)} · GST{' '}
            {formatInrFromPaise(quote.gstFeePaise)}
          </p>
        )}
        {uploadStatus && !error && (
          <p className="mt-4 text-sm text-slate-helper" aria-live="polite">
            {uploadStatus}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="rounded-full px-5 py-2.5 font-switzer text-sm text-slate-helper hover:text-portrait-ink disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void handlePay()}
            disabled={!isAuthed || submitting || quoting || !quote || Boolean(successId)}
            className="rounded-full bg-portrait-ink px-6 py-2.5 font-switzer text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {payLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
