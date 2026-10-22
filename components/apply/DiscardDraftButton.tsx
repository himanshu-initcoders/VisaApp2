'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { clearApplyDraftAsync } from '@/lib/apply/draftStorage';
import {
  deleteApplicationDraft,
  deleteApplicationDraftAsAdmin,
} from '@/lib/apply/serverDraft';

interface DiscardDraftButtonProps {
  listingId: string;
  /** When set, uses admin delete by draft id instead of applicant listing delete. */
  draftId?: string;
  /** Applicant user id when staff discards an on-behalf draft (for local cache). */
  ownerUserId?: string | null;
  mode?: 'applicant' | 'admin';
  className?: string;
}

export function DiscardDraftButton({
  listingId,
  draftId,
  ownerUserId = null,
  mode = 'applicant',
  className,
}: DiscardDraftButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDiscard = () => {
    if (pending) return;
    if (
      !window.confirm(
        'Discard this draft? You can start a new application later.'
      )
    ) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result =
        mode === 'admin' && draftId
          ? await deleteApplicationDraftAsAdmin(draftId)
          : await deleteApplicationDraft(listingId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      await clearApplyDraftAsync({
        listingId,
        sessionUserId: session?.user?.id ?? null,
        onBehalfOfUserId: ownerUserId,
      });
      router.refresh();
    });
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleDiscard}
        disabled={pending}
        className="font-switzer text-sm text-slate-helper underline-offset-2 hover:text-portrait-ink hover:underline disabled:opacity-50"
      >
        {pending ? 'Discarding…' : 'Discard'}
      </button>
      {error && (
        <p className="mt-1 font-switzer text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
