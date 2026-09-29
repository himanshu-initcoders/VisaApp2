'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { addApplicationCallLog } from '@/app/(admin)/actions';

interface AddCallLogFormProps {
  applicationId: string;
  defaultPhone?: string | null;
  onCancel?: () => void;
  onSuccess?: () => void;
}

/**
 * Form to append a call log entry. Mount only when the user chooses to add.
 */
export function AddCallLogForm({
  applicationId,
  defaultPhone,
  onCancel,
  onSuccess,
}: AddCallLogFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone || '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addApplicationCallLog({
        applicationId,
        phone,
        note,
      });
      if (!result.success) {
        setError(result.error || result.message);
        return;
      }
      setNote('');
      router.refresh();
      onSuccess?.();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-ash bg-white p-4"
    >
      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone dialed"
        className="w-full rounded-2xl border border-ash px-3 py-2 font-switzer text-sm text-portrait-ink"
        autoFocus
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Call notes…"
        rows={3}
        className="w-full resize-none rounded-2xl border border-ash px-3 py-2 font-switzer text-sm text-portrait-ink"
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
          disabled={isPending || !phone.trim() || !note.trim()}
        >
          {isPending ? 'Saving…' : 'Save call log'}
        </Button>
      </div>
    </form>
  );
}
