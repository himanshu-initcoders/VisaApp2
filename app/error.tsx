'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

const RELOAD_KEY = 'viserv:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message)
  );
}

/**
 * Root App Router error UI. Auto-reloads once on post-deploy chunk skew.
 */
export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="font-basier text-[31px] text-portrait-ink mb-2">
          This page couldn&apos;t load
        </h2>
        <p className="font-switzer text-sm text-slate-helper mb-6">
          Reload to try again, or go back.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
          <Button type="button" variant="ghost" size="md" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
