'use client';

import { X } from 'lucide-react';
import { MobileOtpSignIn } from '@/components/auth/MobileOtpSignIn';

interface SaveDraftLoginModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

/**
 * OTP sign-in modal so applicants can unlock Save as draft.
 */
export function SaveDraftLoginModal({
  open,
  onClose,
  onVerified,
}: SaveDraftLoginModalProps) {
  if (!open) return null;

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
        aria-labelledby="save-draft-login-title"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-ash bg-white shadow-elevated"
      >
        <div className="flex items-start justify-between gap-3 border-b border-mist px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
              Sign in required
            </p>
            <h2
              id="save-draft-login-title"
              className="mt-1 font-basier text-2xl text-portrait-ink"
            >
              Save as draft
            </h2>
            <p className="mt-1 font-switzer text-sm text-slate-helper">
              Sign in with your mobile number to save this application to your
              account.
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
        <div className="px-5 py-5">
          <MobileOtpSignIn
            variant="checkout-embed"
            onVerified={() => {
              onVerified();
            }}
          />
        </div>
      </div>
    </div>
  );
}
