'use client';

import { useState, useTransition } from 'react';
import { publishFormVersion } from '@/app/(admin)/admin/config/visa-listings/actions';

interface PublishFormVersionButtonProps {
  listingId: string;
  latestVersion: number | null;
  latestPublishedAt: string | null;
}

export function PublishFormVersionButton({
  listingId,
  latestVersion,
  latestPublishedAt,
}: PublishFormVersionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(latestVersion);
  const [publishedAt, setPublishedAt] = useState(latestPublishedAt);

  const handlePublish = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await publishFormVersion(listingId);
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      if (result.version != null) {
        setVersion(result.version);
      }
      if (result.publishedAt) {
        setPublishedAt(result.publishedAt);
      }
      setMessage(result.message ?? 'Published');
    });
  };

  return (
    <div className="rounded-[24px] border border-ash bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-basier text-xl text-portrait-ink">Form versions</h2>
          <p className="mt-1 text-sm text-slate-helper">
            {version != null
              ? `Latest published: v${version}${
                  publishedAt
                    ? ` · ${new Date(publishedAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}`
                    : ''
                }`
              : 'No form version published yet. Applicants cannot submit until you publish.'}
          </p>
          {message && (
            <p className="mt-2 text-sm text-portrait-ink">{message}</p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full border border-portrait-ink px-6 py-3 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink hover:text-white disabled:opacity-50"
        >
          {isPending ? 'Publishing…' : 'Publish form version'}
        </button>
      </div>
    </div>
  );
}
