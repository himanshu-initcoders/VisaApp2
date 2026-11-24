'use client';

import { useEffect } from 'react';

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
 * Catches root-layout failures. Must define its own <html>/<body>.
 * Auto-reloads once when the failure is post-deploy chunk skew.
 */
export default function GlobalError({
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
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#fff',
          color: '#08304c',
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, margin: '0 0 8px' }}>This page couldn&apos;t load</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            Reload to try again, or go back.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                borderRadius: 28,
                border: '1.5px solid #08304c',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: 28,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 16,
                color: '#08304c',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
