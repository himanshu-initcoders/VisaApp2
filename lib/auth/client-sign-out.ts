'use client';

import { getCsrfToken } from 'next-auth/react';

function notifyOtherTabsSignedOut() {
  try {
    const channel = new BroadcastChannel('next-auth');
    channel.postMessage({
      event: 'session',
      data: { trigger: 'signout' },
    });
    channel.close();
  } catch {
    // BroadcastChannel unavailable — same-tab hard navigation still clears session.
  }
}

/**
 * Production-safe client logout.
 *
 * next-auth/react `signOut({ callbackUrl })` is unreliable when already on the
 * callback URL (e.g. home `/`): browsers often skip navigation, so:
 * 1. React session state stays "authenticated"
 * 2. An in-flight GET /api/auth/session can finish after the cookie was cleared
 *    and re-issue a rolling JWT cookie — refresh still looks logged in
 *
 * This helper posts signout once, notifies other tabs, then forces a full
 * document load so pending session fetches are aborted and cannot resurrect
 * the cookie.
 */
export async function secureClientSignOut(callbackUrl = '/'): Promise<void> {
  const csrfToken = await getCsrfToken();

  await fetch('/api/auth/signout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({
      csrfToken: csrfToken ?? '',
      callbackUrl,
    }),
    credentials: 'same-origin',
  });

  notifyOtherTabsSignedOut();

  const target = new URL(callbackUrl, window.location.origin);
  const sameDocument =
    target.pathname === window.location.pathname &&
    target.search === window.location.search;

  if (sameDocument) {
    window.location.reload();
    return;
  }

  window.location.assign(target.href);
}
