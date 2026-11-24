'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'viserv:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * After a deploy, open tabs still reference hashed `/_next/static` chunks from the
 * previous build. Those URLs 404 → ChunkLoadError → blank error UI.
 * Reload once to pick up the new HTML + chunk map; guard against loops.
 */
function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    e.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage blocked — still attempt one reload
  }
  window.location.reload();
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) {
        event.preventDefault();
        reloadOnce();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        reloadOnce();
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
