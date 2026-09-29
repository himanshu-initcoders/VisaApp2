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

  const handleMockPay = async () => {
    if (!isAuthed || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      if (!submitIdRef.current) {
        submitIdRef.current = newSubmitId();
      }

      const draft = readApplyDraft(listingId);
      if (!draft || !draft.travellers?.length) {
        setError('No application draft found. Go back and complete the form.');
        setSubmitting(false);
        return;
      }

      const files = await collectIdbFilesForSubmit(listingId, draft.travellers);

      const result = await submitApplication({
        submitId: submitIdRef.current,
        listingId,
        countryCode,
        travellers: draft.travellers.map((t) => ({
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
        })),
        files,
      });

      if (!result.success) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      await clearLocalDraftAfterSubmit(listingId);
      setSuccessId(result.applicationId);
      setSubmitting(false);
      router.push(`/dashboard?submitted=${result.applicationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
      setSubmitting(false);
    }
  };

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
        <p className="text-sm text-slate-helper">
          Mock payment submits your application (no real charge).
        </p>
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
          disabled={!isAuthed || submitting || Boolean(successId)}
          className={cn(
            'mt-4 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-white transition-opacity',
            isAuthed && !submitting
              ? 'bg-[#3b82f6] hover:opacity-90'
              : 'cursor-not-allowed bg-slate-helper/40'
          )}
          onClick={() => {
            void handleMockPay();
          }}
        >
          {!isAuthed
            ? 'Login required to pay'
            : submitting
              ? 'Submitting…'
              : successId
                ? 'Submitted'
                : 'Mock pay & submit'}
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
