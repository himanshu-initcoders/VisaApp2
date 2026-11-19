'use client';

import { X } from 'lucide-react';
import { ApplicantAuthPanel } from '@/components/auth/ApplicantAuthPanel';

interface SaveDraftLoginModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

/**
 * Mobile WhatsApp OTP modal so applicants can unlock Save as draft.
 */
export function SaveDraftLoginModal({
  open,
  onClose,
  onVerified,
}: SaveDraftLoginModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-portrait-ink/40 p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-draft-login-title"
        className="relative flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-ash bg-white shadow-elevated"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-mist px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
              Sign in required
            </p>
            <h2
              id="save-draft-login-title"
              className="mt-0.5 font-basier text-xl text-portrait-ink sm:text-2xl"
            >
              Save as draft
            </h2>
            <p className="mt-1 font-switzer text-sm text-slate-helper">
              WhatsApp OTP to save this application to your account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-helper hover:bg-mist hover:text-portrait-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <ApplicantAuthPanel
            variant="modal-embed"
            analyticsContext="save_draft"
            onVerified={() => {
              onVerified();
            }}
          />
        </div>
      </div>
    </div>
  );
}
