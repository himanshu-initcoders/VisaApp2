/**
 * Lightweight localStorage cursor for apply wizards so a browser refresh
 * restores the same step / form tab the user was on.
 */

import type { ApplicationFormTabId } from '@/lib/apply/applicationForm';
import type { ApplyStep } from '@/lib/apply/types';

const VISA_CURSOR_PREFIX = 'visa-apply-step:v1:';
const PASSPORT_CURSOR_PREFIX = 'passport-apply-step:v1:';
const VISA_LIVE_SESSION_PREFIX = 'visa-apply-live:v1:';

export type VisaWizardStepCursor = {
  listingId: string;
  step: ApplyStep;
  /** Traveller form tab (Personal details, Trip, …) while overlay is open. */
  formTab?: ApplicationFormTabId | null;
  /** Traveller whose passport/form overlay was open. */
  activeTravellerId?: string | null;
  updatedAt: string;
};

export type PassportWizardStepCursor = {
  listingId: string;
  macro: 'form' | 'documents' | 'review';
  stepIndex: number;
  updatedAt: string;
};

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function visaCursorKey(listingId: string, scopeUserId?: string | null) {
  const scope = scopeUserId?.trim() || 'guest';
  return `${VISA_CURSOR_PREFIX}${scope}:${listingId}`;
}

function passportCursorKey(listingId: string) {
  return `${PASSPORT_CURSOR_PREFIX}${listingId}`;
}

function visaLiveSessionKey(listingId: string) {
  return `${VISA_LIVE_SESSION_PREFIX}${listingId}`;
}

export function markVisaApplyLiveSession(listingId: string) {
  if (!canUseSessionStorage() || !listingId) return;
  try {
    sessionStorage.setItem(visaLiveSessionKey(listingId), '1');
  } catch {
    // private mode / quota
  }
}

export function isVisaApplyLiveSession(listingId: string): boolean {
  if (!canUseSessionStorage() || !listingId) return false;
  try {
    return sessionStorage.getItem(visaLiveSessionKey(listingId)) === '1';
  } catch {
    return false;
  }
}

export function clearVisaApplyLiveSession(listingId: string) {
  if (!canUseSessionStorage() || !listingId) return;
  try {
    sessionStorage.removeItem(visaLiveSessionKey(listingId));
  } catch {
    // ignore
  }
}

export function readVisaWizardStepCursor(
  listingId: string,
  scopeUserId?: string | null
): VisaWizardStepCursor | null {
  if (!canUseLocalStorage() || !listingId) return null;
  try {
    const raw = localStorage.getItem(visaCursorKey(listingId, scopeUserId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisaWizardStepCursor;
    if (!parsed || parsed.listingId !== listingId) return null;
    if (
      parsed.step !== 'travellers' &&
      parsed.step !== 'documents' &&
      parsed.step !== 'pay'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeVisaWizardStepCursor(
  cursor: Omit<VisaWizardStepCursor, 'updatedAt'> & { updatedAt?: string },
  scopeUserId?: string | null
) {
  if (!canUseLocalStorage() || !cursor.listingId) return;
  try {
    const payload: VisaWizardStepCursor = {
      listingId: cursor.listingId,
      step: cursor.step,
      formTab: cursor.formTab ?? null,
      activeTravellerId: cursor.activeTravellerId ?? null,
      updatedAt: cursor.updatedAt ?? new Date().toISOString(),
    };
    localStorage.setItem(
      visaCursorKey(cursor.listingId, scopeUserId),
      JSON.stringify(payload)
    );
  } catch {
    // ignore
  }
}

export function clearVisaWizardStepCursor(
  listingId: string,
  scopeUserId?: string | null
) {
  if (!canUseLocalStorage() || !listingId) return;
  try {
    localStorage.removeItem(visaCursorKey(listingId, scopeUserId));
  } catch {
    // ignore
  }
}

export function readPassportWizardStepCursor(
  listingId: string
): PassportWizardStepCursor | null {
  if (!canUseLocalStorage() || !listingId) return null;
  try {
    const raw = localStorage.getItem(passportCursorKey(listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PassportWizardStepCursor;
    if (!parsed || parsed.listingId !== listingId) return null;
    if (
      parsed.macro !== 'form' &&
      parsed.macro !== 'documents' &&
      parsed.macro !== 'review'
    ) {
      return null;
    }
    if (typeof parsed.stepIndex !== 'number' || parsed.stepIndex < 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePassportWizardStepCursor(
  cursor: Omit<PassportWizardStepCursor, 'updatedAt'> & { updatedAt?: string }
) {
  if (!canUseLocalStorage() || !cursor.listingId) return;
  try {
    const payload: PassportWizardStepCursor = {
      listingId: cursor.listingId,
      macro: cursor.macro,
      stepIndex: cursor.stepIndex,
      updatedAt: cursor.updatedAt ?? new Date().toISOString(),
    };
    localStorage.setItem(
      passportCursorKey(cursor.listingId),
      JSON.stringify(payload)
    );
  } catch {
    // ignore
  }
}

export function clearPassportWizardStepCursor(listingId: string) {
  if (!canUseLocalStorage() || !listingId) return;
  try {
    localStorage.removeItem(passportCursorKey(listingId));
  } catch {
    // ignore
  }
}
