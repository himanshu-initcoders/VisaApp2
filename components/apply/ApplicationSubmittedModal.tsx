'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Home } from 'lucide-react';

interface ApplicationSubmittedModalProps {
  open: boolean;
  /** visa | passport — tweaks copy only */
  product?: 'visa' | 'passport';
  /** Optional short reference shown under the title */
  referenceHint?: string | null;
  /** Go to the submitted application detail page. */
  onContinue: () => void;
  /** Go to the applicant home / dashboard. */
  onHome: () => void;
  /** Auto-continue after this many ms (default 5000). Pass 0 to disable. */
  autoContinueMs?: number;
}

/**
 * Shown after payment confirmation / free submit succeeds, before redirect.
 */
export function ApplicationSubmittedModal({
  open,
  product = 'visa',
  referenceHint = null,
  onContinue,
  onHome,
  autoContinueMs = 5000,
}: ApplicationSubmittedModalProps) {
  const continuedRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  const onHomeRef = useRef(onHome);
  onContinueRef.current = onContinue;
  onHomeRef.current = onHome;

  const totalSeconds = Math.max(0, Math.ceil(autoContinueMs / 1000));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    if (!open) {
      continuedRef.current = false;
      setSecondsLeft(totalSeconds);
      return;
    }

    setSecondsLeft(totalSeconds);
    if (!autoContinueMs || autoContinueMs <= 0) return;

    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(
        0,
        Math.ceil((autoContinueMs - elapsed) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(tick);
        if (continuedRef.current) return;
        continuedRef.current = true;
        onContinueRef.current();
      }
    }, 250);

    return () => window.clearInterval(tick);
  }, [open, autoContinueMs, totalSeconds]);

  if (!open) return null;

  const finish = (action: 'continue' | 'home') => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    if (action === 'home') onHomeRef.current();
    else onContinueRef.current();
  };

  const productLabel = product === 'passport' ? 'passport' : 'visa';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-portrait-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-submitted-title"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-ash bg-white shadow-elevated"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 100% 0%, #d7ffe2 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, #e8f1ff 0%, transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative px-6 pb-6 pt-8 text-center sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint-wash ring-1 ring-portrait-ink/10">
            <Check
              className="h-7 w-7 text-portrait-ink"
              strokeWidth={2.5}
              aria-hidden
            />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
            {product === 'passport' ? 'Passport' : 'Visa'} application
          </p>
          <h2
            id="application-submitted-title"
            className="mt-1 font-basier text-3xl text-portrait-ink"
          >
            Application submitted
          </h2>
          <p className="mx-auto mt-3 max-w-sm font-switzer text-sm leading-6 text-slate-helper">
            We&apos;ve received your application and will update you as it moves
            through review.
          </p>
          {referenceHint ? (
            <p className="mt-3 font-switzer text-xs text-slate-helper">
              Ref · {referenceHint}
            </p>
          ) : null}

          {autoContinueMs > 0 ? (
            <p
              className="mx-auto mt-5 max-w-sm font-switzer text-sm leading-6 text-portrait-ink"
              aria-live="polite"
            >
              You will be auto-redirected to your {productLabel} application in{' '}
              <span className="tabular-nums font-semibold">{secondsLeft}</span>{' '}
              second{secondsLeft === 1 ? '' : 's'}.
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => finish('home')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-portrait-ink bg-white px-6 py-2.5 font-switzer text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash sm:w-auto sm:min-w-[140px]"
            >
              <Home className="h-4 w-4 shrink-0" aria-hidden />
              Home
            </button>
            <button
              type="button"
              onClick={() => finish('continue')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-portrait-ink px-6 py-2.5 font-switzer text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[160px]"
            >
              Continue
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
