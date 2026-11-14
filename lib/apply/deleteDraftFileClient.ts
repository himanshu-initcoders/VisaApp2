/**
 * Client helper: delete a server draft object via /api/apply/draft-files.
 */

'use client';

export async function deleteServerDraftFile(input: {
  storageKey: string;
  ownerUserId?: string | null;
  applicationId?: string | null;
}): Promise<boolean> {
  const key = input.storageKey.trim();
  if (!key) return false;

  try {
    const response = await fetch('/api/apply/draft-files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storageKey: key,
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.applicationId
          ? { applicationId: input.applicationId }
          : {}),
      }),
    });
    if (!response.ok) {
      console.warn(
        '[Draft] Failed to delete server draft file:',
        key,
        response.status
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[Draft] Failed to delete server draft file:', key, error);
    return false;
  }
}
