'use client';

import { ArrowRight, FileText, Plus, RotateCcw, X } from 'lucide-react';
import { formatDraftUpdatedAt, type ApplyDraft } from '@/lib/apply/draftStorage';

interface ResumeOrNewModalProps {
  open: boolean;
  draft: ApplyDraft;
  onClose: () => void;
  onResume: () => void;
  onStartNew: () => void;
}

export function ResumeOrNewModal({
  open,
  draft,
  onClose,
  onResume,
  onStartNew,
}: ResumeOrNewModalProps) {
  if (!open) return null;

  const named = draft.travellers.filter((t) => t.name.trim()).length;
  const docs = draft.travellers.filter(
    (t) => t.photoUploaded || t.passportUploaded
  ).length;
  const stepLabel =
    draft.step === 'travellers'
      ? 'Travelers'
      : draft.step === 'documents'
        ? 'Documents'
        : 'Pay';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-portrait-ink/40 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-or-new-title"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-ash bg-white shadow-elevated"
      >
        <div className="flex items-start justify-between gap-3 border-b border-mist px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
              Saved application
            </p>
            <h2
              id="resume-or-new-title"
              className="mt-1 font-basier text-2xl text-portrait-ink"
            >
              Continue where you left off?
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full border border-ash p-2 text-slate-helper hover:text-portrait-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-ash bg-sky-wash/50 px-4 py-3">
            <p className="text-sm font-medium text-portrait-ink">
              {draft.processName}
            </p>
            <p className="mt-0.5 text-xs text-slate-helper">
              {draft.countryName}
              {draft.departure.label ? ` · ${draft.departure.label}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-helper">
              <span className="rounded-full bg-white px-2.5 py-1">
                Step · {stepLabel}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1">
                {named || draft.travellersCount} traveller
                {(named || draft.travellersCount) === 1 ? '' : 's'}
              </span>
              {docs > 0 && (
                <span className="rounded-full bg-white px-2.5 py-1">
                  {docs} with docs
                </span>
              )}
              {draft.updatedAt && (
                <span className="rounded-full bg-white px-2.5 py-1">
                  Saved {formatDraftUpdatedAt(draft.updatedAt)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onResume}
            className="flex w-full items-center gap-3 rounded-[20px] bg-portrait-ink px-4 py-3.5 text-left text-white transition-opacity hover:opacity-90"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <RotateCcw className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Resume application</span>
              <span className="mt-0.5 block text-xs text-white/70">
                Restore travellers, passport details, and current step
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-80" />
          </button>

          <button
            type="button"
            onClick={onStartNew}
            className="flex w-full items-center gap-3 rounded-[20px] border border-ash bg-white px-4 py-3.5 text-left text-portrait-ink transition-colors hover:bg-mist"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-peach-wash">
              <Plus className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Start new application</span>
              <span className="mt-0.5 block text-xs text-slate-helper">
                Clears the saved draft and starts fresh
              </span>
            </span>
            <FileText className="h-4 w-4 shrink-0 text-slate-helper" />
          </button>
        </div>
      </div>
    </div>
  );
}
