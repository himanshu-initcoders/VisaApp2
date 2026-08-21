import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';

export type { ApplyStep, ApplyTraveller };

export const APPLY_DRAFT_VERSION = 1 as const;
export const APPLY_DRAFT_PREFIX = 'visa-apply-draft:v1:';

export interface ApplyDraftDeparture {
  mode?: string;
  departure?: string;
  month?: string;
  label?: string | null;
  priceOption?: string;
}

export interface ApplyDraft {
  version: typeof APPLY_DRAFT_VERSION;
  updatedAt: string;
  countryCode: string;
  countryName: string;
  listingId: string;
  processName: string;
  step: ApplyStep;
  primaryName: string;
  travellers: ApplyTraveller[];
  departure: ApplyDraftDeparture;
  travellersCount: number;
}

function storageKey(listingId: string) {
  return `${APPLY_DRAFT_PREFIX}${listingId}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/** Strip ephemeral UI flags before writing. */
export function serializeTravellersForDraft(
  travellers: ApplyTraveller[]
): ApplyTraveller[] {
  return travellers.map((traveller) => ({
    ...traveller,
    editing: false,
  }));
}

export function readApplyDraft(listingId: string): ApplyDraft | null {
  if (!canUseStorage() || !listingId) return null;
  try {
    const raw = localStorage.getItem(storageKey(listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApplyDraft;
    if (parsed?.version !== APPLY_DRAFT_VERSION) return null;
    if (parsed.listingId !== listingId) return null;
    if (!Array.isArray(parsed.travellers) || parsed.travellers.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasApplyDraft(listingId: string): boolean {
  return Boolean(readApplyDraft(listingId));
}

export function writeApplyDraft(draft: ApplyDraft): void {
  if (!canUseStorage()) return;
  try {
    const payload: ApplyDraft = {
      ...draft,
      version: APPLY_DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      travellers: serializeTravellersForDraft(draft.travellers),
      travellersCount: Math.max(1, draft.travellers.length),
    };
    localStorage.setItem(storageKey(draft.listingId), JSON.stringify(payload));
  } catch (error) {
    // Quota / private mode — application continues without persistence
    console.warn('Could not save application draft', error);
  }
}

export function clearApplyDraft(listingId: string): void {
  if (!canUseStorage() || !listingId) return;
  try {
    localStorage.removeItem(storageKey(listingId));
  } catch {
    // ignore
  }
}

export function formatDraftUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Convert blob: preview URLs to durable data URLs for localStorage. */
export async function persistPreviewUrl(
  url?: string
): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  if (!url.startsWith('blob:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
