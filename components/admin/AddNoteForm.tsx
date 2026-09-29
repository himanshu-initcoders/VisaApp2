'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { addApplicationNote } from '@/app/(admin)/actions';

interface AddNoteFormProps {
  applicationId: string;
  applicationType?: 'visa' | 'passport';
  onCancel?: () => void;
  onSuccess?: () => void;
}

/**
 * Form to append an internal note. Mount only when the user chooses to add.
 */
export function AddNoteForm({
  applicationId,
  applicationType = 'visa',
  onCancel,
  onSuccess,
}: AddNoteFormProps) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addApplicationNote({
        applicationId,
        applicationType,
        note: body,
      });
      if (!result.success) {
        setError(result.error || result.message);
        return;
      }
      setBody('');
      router.refresh();
      onSuccess?.();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-ash bg-white p-4"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an internal note…"
        rows={4}
        className="w-full resize-none rounded-2xl border border-ash px-3 py-2 font-switzer text-sm text-portrait-ink"
        autoFocus
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isPending || !body.trim()}
        >
          {isPending ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </form>
  );
}
