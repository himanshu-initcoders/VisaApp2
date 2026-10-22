/**
 * Client draft storage scope: isolate drafts by applicant identity.
 */

export type DraftScopeInput = {
  listingId: string;
  /** Applicant being filled for (staff on-behalf), else session user. */
  onBehalfOfUserId?: string | null;
  sessionUserId?: string | null;
};

/** Stable scope user for localStorage / IndexedDB keys. */
export function resolveDraftScopeUserId(
  input: Pick<DraftScopeInput, 'onBehalfOfUserId' | 'sessionUserId'>
): string {
  const onBehalf = input.onBehalfOfUserId?.trim();
  if (onBehalf) return onBehalf;
  const session = input.sessionUserId?.trim();
  if (session) return session;
  return 'anon';
}

/** Composite storage key: `{scopeUserId}:{listingId}`. */
export function draftStorageCompositeKey(
  scopeUserId: string,
  listingId: string
): string {
  return `${scopeUserId}:${listingId}`;
}

export function resolveDraftCompositeKey(input: DraftScopeInput): string {
  return draftStorageCompositeKey(
    resolveDraftScopeUserId(input),
    input.listingId
  );
}
