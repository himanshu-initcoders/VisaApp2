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
  statusText = 'Reading MRZ…',
}: PassportScanStageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-portrait-ink shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center sm:top-5">
          <p className="font-basier text-2xl text-portrait-ink sm:text-3xl">
            Passport,
          </p>
          <p className="font-basier text-xl text-[#6b8cff] sm:text-2xl">
            photo page up
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-full border border-ash p-2 text-slate-helper hover:text-portrait-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-10 sm:px-6">
        <div className="relative w-full overflow-hidden rounded-[24px] bg-[#0b1220] shadow-elevated aspect-[16/10]">
          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Passport being scanned"
              className="h-full w-full object-contain opacity-90"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
              Reading document…
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
        <p className="mt-6 text-sm font-medium text-slate-helper">{statusText}</p>
      </div>
    </div>
  );
}
