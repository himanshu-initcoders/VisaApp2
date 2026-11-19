/**
 * Pure traveler identity helpers (no DB imports — safe for vault store).
 * Unique key = name + DOB + passport number.
 */

export type IdentityTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePassport(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeName(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function displayTravelerName(traveller: IdentityTraveller): string {
  const named = str(traveller.name);
  if (named) return named;
  const passport = traveller.passportData || {};
  const given = str(passport.givenNames);
  const surname = str(passport.surname);
  const combined = [given, surname].filter(Boolean).join(' ').trim();
  return combined;
}

export type TravelerIdentityParts = {
  name: string;
  dateOfBirth: string;
  passportNumber: string;
};

/** Extract required identity fields; null if any piece is missing. */
export function travelerIdentityParts(
  traveller: IdentityTraveller
): TravelerIdentityParts | null {
  const passport = traveller.passportData || {};
  const name = normalizeName(displayTravelerName(traveller));
  const dateOfBirth = str(passport.dateOfBirth);
  const passportNumber = normalizePassport(str(passport.passportNumber));
  if (!name || name === 'traveller' || !dateOfBirth || !passportNumber) {
    return null;
  }
  return { name, dateOfBirth, passportNumber };
}

/**
 * Stable identity across applications: name + DOB + passport.
 * Returns null when identity is incomplete (do not create a profile).
 */
export function travelerProfileKey(traveller: IdentityTraveller): string | null {
  const parts = travelerIdentityParts(traveller);
  if (!parts) return null;
  return `npd:${parts.name}|${parts.dateOfBirth}|${parts.passportNumber}`;
}

/** @deprecated Use travelerProfileKey */
export const passengerProfileKey = travelerProfileKey;
