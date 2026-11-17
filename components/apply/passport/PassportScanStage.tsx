'use client';

import { ArrowLeft, X } from 'lucide-react';

interface PassportScanStageProps {
  previewUrl?: string | null;
  onBack: () => void;
  onClose: () => void;
  statusText?: string;
}

export function PassportScanStage({
  previewUrl,
  onBack,
  onClose,
  statusText = 'Reading your details…',
}: PassportScanStageProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <header className="relative z-10 shrink-0 px-4 pb-4 pt-4 sm:px-6 sm:pb-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-portrait-ink shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Back
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full border border-ash p-2 text-slate-helper hover:text-portrait-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 text-center sm:mt-5">
          <p className="font-basier text-2xl leading-tight text-portrait-ink sm:text-3xl">
            Passport,
          </p>
          <p className="font-basier text-xl leading-tight text-[#6b8cff] sm:text-2xl">
            {statusText}
          </p>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-8 sm:px-6">
        <div
          className="relative w-full max-h-full overflow-hidden rounded-[24px] bg-[#0b1220] shadow-elevated"
          style={{
            aspectRatio: '16 / 10',
            maxHeight: 'min(100%, calc(100dvh - 12rem))',
            width: 'min(100%, calc((100dvh - 12rem) * 1.6))',
          }}
        >
          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Passport being scanned"
              className="h-full w-full object-contain opacity-90"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
              Preparing scan…
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,197,94,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.18) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 h-0.5 animate-[passport-scan_1.6s_ease-in-out_infinite] bg-[#22c55e] shadow-[0_0_12px_2px_rgba(34,197,94,0.85)]" />
        </div>
      </div>
    </div>
  );
}
