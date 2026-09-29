/**
 * Apply-step previous profiles + autofill from past visa applications.
 * Matches by stable question/document keys (not DB UUIDs).
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';
import {
  emptyTripDetails,
  type ApplyFormConfig,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
} from '@/lib/apply/idbDraftStorage';
import {
  avatarVariantFromName,
  formatVisaTypeLabel,
} from '@/lib/apply/travellerProfiles';
import {
  passengerProfileKey,
} from '@/lib/dashboard/passengerProfiles';
import type { IndianPassportFields } from '@/lib/passport/types';

type StoredTravellerDoc = {
  slotKey?: string;
  key?: string;
  url?: string;
  mimeType?: string;
  filename?: string;
};

type StoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Partial<TravellerTripDetails> | null;
  documents?: StoredTravellerDoc[] | null;
};

/** Carousel card for apply step 1 (authenticated). */
export type ApplyPreviousProfile = {
  id: string;
  name: string;
  nationality: string;
  countryCode: string;
  visaType: string;
  avatarVariant: number;
  applicationCount: number;
  isServerProfile: true;
};

export type AutofillDocumentRef = {
  slotKey: string;
  documentDbId: string | null;
  storageKey: string | null;
  filename: string;
  mimeType: string | null;
};

export type PassengerAutofillPayload = {
  profileId: string;
  name: string;
  passportData: IndianPassportFields | null;
  tripDetails: TravellerTripDetails | null;
  documents: AutofillDocumentRef[];
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function displayName(traveller: StoredTraveller): string {
  const named = str(traveller.name);
  if (named) return named;
  const passport = traveller.passportData || {};
  const given = str(passport.givenNames);
  const surname = str(passport.surname);
  const combined = [given, surname].filter(Boolean).join(' ').trim();
  return combined || 'Traveller';
}

function extractPassengerIdFromKey(s3Key: string): string | null {
  const match = s3Key.match(/\/passengers\/([^/]+)\//);
  return match?.[1] ?? null;
}

function toPassportFields(
  raw: Record<string, unknown> | null | undefined
): IndianPassportFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const passportNumber = str(raw.passportNumber);
  const surname = str(raw.surname);
  const givenNames = str(raw.givenNames);
  if (!passportNumber && !surname && !givenNames) return null;

  const sexRaw = str(raw.sex);
  const sex =
    sexRaw === 'M' || sexRaw === 'F' || sexRaw === 'X' ? sexRaw : '';

  return {
    passportNumber,
    surname,
    givenNames,
    nationality: str(raw.nationality) || 'IND',
    dateOfBirth: str(raw.dateOfBirth),
    sex,
    dateOfExpiry: str(raw.dateOfExpiry),
    documentType: str(raw.documentType) || 'P',
    countryOfIssue: str(raw.countryOfIssue) || 'IND',
    fathersName: str(raw.fathersName) || undefined,
    mothersName: str(raw.mothersName) || undefined,
    spouseName: str(raw.spouseName) || undefined,
    dateOfIssue: str(raw.dateOfIssue) || undefined,
    placeOfBirth: str(raw.placeOfBirth) || undefined,
    placeOfIssue: str(raw.placeOfIssue) || undefined,
    address: str(raw.address) || undefined,
    fileNumber: str(raw.fileNumber) || undefined,
    oldPassportNumber: str(raw.oldPassportNumber) || undefined,
    oldPassportDateOfIssue: str(raw.oldPassportDateOfIssue) || undefined,
    oldPassportPlaceOfIssue: str(raw.oldPassportPlaceOfIssue) || undefined,
    email: str(raw.email) || undefined,
    phone: str(raw.phone) || undefined,
  };
}

type AppRow = {
  id: string;
  country: string | null;
  countryCode: string | null;
  visaType: string | null;
  travellers: unknown;
  applicantName: string | null;
};

async function loadUserVisaApps(userId: string): Promise<AppRow[]> {
  return db
    .select({
      id: visaApplications.id,
      country: visaApplications.country,
      countryCode: visaApplications.countryCode,
      visaType: visaApplications.visaType,
      travellers: visaApplications.travellers,
      applicantName: visaApplications.applicantName,
    })
    .from(visaApplications)
    .where(eq(visaApplications.userId, userId))
    .orderBy(desc(visaApplications.createdAt));
}

type MutableApplyProfile = {
  id: string;
  name: string;
  nationality: string | null;
  applicationIds: Set<string>;
  lastVisaLabel: string;
  lastCountryCode: string;
};

/**
 * Carousel-friendly previous profiles for the apply first step.
 */
export async function getApplyPreviousProfiles(
  userId: string
): Promise<ApplyPreviousProfile[]> {
  const apps = await loadUserVisaApps(userId);
  if (apps.length === 0) return [];

  const profiles = new Map<string, MutableApplyProfile>();

  for (const app of apps) {
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    const entries: StoredTraveller[] =
      travellers.length > 0
        ? travellers
        : [
            {
              passengerId: `legacy-${app.id}`,
              name: app.applicantName || 'Applicant',
              passportData: null,
            },
          ];

    for (const traveller of entries) {
      const id = passengerProfileKey(traveller);
      const existing = profiles.get(id);
      if (existing) {
        existing.applicationIds.add(app.id);
        const nextName = displayName(traveller);
        if (nextName && nextName !== 'Traveller') existing.name = nextName;
        continue;
      }

      const passport = traveller.passportData || {};
      profiles.set(id, {
        id,
        name: displayName(traveller),
        nationality: str(passport.nationality) || null,
        applicationIds: new Set([app.id]),
        lastVisaLabel: formatVisaTypeLabel(app.visaType || 'Visa'),
        lastCountryCode: (app.countryCode || 'IN').toUpperCase(),
      });
    }
  }

  return Array.from(profiles.values())
    .map((p) => ({
      id: p.id,
      name: p.name,
      nationality:
        p.nationality === 'IND' || !p.nationality ? 'India' : p.nationality,
      countryCode: p.lastCountryCode || 'IN',
      visaType: p.lastVisaLabel || 'Visa',
      avatarVariant: avatarVariantFromName(p.name),
      applicationCount: p.applicationIds.size,
      isServerProfile: true as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeTripDetails(
  current: TravellerTripDetails | null,
  incoming: Partial<TravellerTripDetails> | null | undefined,
  allowedExtraKeys: Set<string>
): TravellerTripDetails {
  const base = current ?? emptyTripDetails();
  if (!incoming) return base;

  const next = emptyTripDetails({
    purpose: base.purpose || str(incoming.purpose),
    arrivalDate: base.arrivalDate || str(incoming.arrivalDate),
    returnDate: base.returnDate || str(incoming.returnDate),
    arrivalCity: base.arrivalCity || str(incoming.arrivalCity),
    accommodationName:
      base.accommodationName || str(incoming.accommodationName),
    accommodationAddress:
      base.accommodationAddress || str(incoming.accommodationAddress),
    flightNumber: base.flightNumber || str(incoming.flightNumber),
    arrivalFlightDate:
      base.arrivalFlightDate || str(incoming.arrivalFlightDate),
    returnFlightNumber:
      base.returnFlightNumber || str(incoming.returnFlightNumber),
    returnFlightDate: base.returnFlightDate || str(incoming.returnFlightDate),
    arrivalFlightMode: base.flightNumber.trim()
      ? base.arrivalFlightMode
      : incoming.arrivalFlightMode,
    returnFlightMode: base.returnFlightNumber.trim()
      ? base.returnFlightMode
      : incoming.returnFlightMode,
    arrivalFlights: base.flightNumber.trim()
      ? base.arrivalFlights
      : incoming.arrivalFlights,
    returnFlights: base.returnFlightNumber.trim()
      ? base.returnFlights
      : incoming.returnFlights,
    extra: { ...base.extra },
  });

  const incomingExtra =
    incoming.extra && typeof incoming.extra === 'object'
      ? incoming.extra
      : {};

  for (const key of allowedExtraKeys) {
    if (next.extra[key]?.trim()) continue;
    const value = str(incomingExtra[key as keyof typeof incomingExtra]);
    if (value) next.extra[key] = value;
  }

  return next;
}

/**
 * Build autofill payload for a passenger profile against the current listing form.
 * Newest applications win; older apps only fill gaps.
 */
export async function getPassengerAutofillForListing(input: {
  userId: string;
  profileId: string;
  formConfig: ApplyFormConfig;
}): Promise<PassengerAutofillPayload | null> {
  const { userId, profileId, formConfig } = input;
  const apps = await loadUserVisaApps(userId);
  if (apps.length === 0) return null;

  const allowedExtraKeys = new Set(
    formConfig.extraQuestions.map((q) => q.key)
  );
  const allowedDocSlots = new Set([
    ...formConfig.documentSlots.map((s) => s.key),
    PASSPORT_FRONT_SLOT,
    PASSPORT_BACK_SLOT,
  ]);

  const appIds = apps.map((a) => a.id);
  const dbDocs =
    appIds.length > 0
      ? await db
          .select()
          .from(documents)
          .where(
            and(
              inArray(documents.applicationId, appIds),
              eq(documents.applicationType, 'visa')
            )
          )
          .orderBy(desc(documents.uploadedAt))
      : [];

  const docsByApp = new Map<string, typeof dbDocs>();
  for (const doc of dbDocs) {
    const list = docsByApp.get(doc.applicationId) ?? [];
    list.push(doc);
    docsByApp.set(doc.applicationId, list);
  }

  let name = '';
  let passportData: IndianPassportFields | null = null;
  let tripDetails: TravellerTripDetails | null = null;
  const docsBySlot = new Map<string, AutofillDocumentRef>();
  let matched = false;

  for (const app of apps) {
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    if (travellers.length === 0) {
      const legacyKey = passengerProfileKey({
        passengerId: `legacy-${app.id}`,
        name: app.applicantName || 'Applicant',
      });
      if (legacyKey !== profileId) continue;
      matched = true;
      if (!name) name = app.applicantName || 'Applicant';

      for (const doc of docsByApp.get(app.id) ?? []) {
        if (!allowedDocSlots.has(doc.documentType)) continue;
        if (docsBySlot.has(doc.documentType)) continue;
        docsBySlot.set(doc.documentType, {
          slotKey: doc.documentType,
          documentDbId: doc.id,
          storageKey: doc.s3Key,
          filename: doc.filename,
          mimeType: doc.mimeType,
        });
      }
      continue;
    }

    for (const traveller of travellers) {
      if (passengerProfileKey(traveller) !== profileId) continue;
      matched = true;
      if (!name) name = displayName(traveller);
      if (!passportData) {
        passportData = toPassportFields(traveller.passportData);
      }
      tripDetails = mergeTripDetails(
        tripDetails,
        traveller.tripDetails,
        allowedExtraKeys
      );

      for (const tdoc of traveller.documents ?? []) {
        const slotKey = tdoc.slotKey || '';
        if (!slotKey || !allowedDocSlots.has(slotKey)) continue;
        if (docsBySlot.has(slotKey)) continue;
        if (!tdoc.key && !tdoc.url) continue;
        docsBySlot.set(slotKey, {
          slotKey,
          documentDbId: null,
          storageKey: tdoc.key || null,
          filename: tdoc.filename || `${slotKey}.bin`,
          mimeType: tdoc.mimeType || null,
        });
      }

      for (const doc of docsByApp.get(app.id) ?? []) {
        if (!allowedDocSlots.has(doc.documentType)) continue;
        const passengerId = extractPassengerIdFromKey(doc.s3Key);
        if (
          traveller.passengerId &&
          passengerId &&
          passengerId !== traveller.passengerId
        ) {
          continue;
        }
        const existing = docsBySlot.get(doc.documentType);
        if (existing?.documentDbId) continue;
        docsBySlot.set(doc.documentType, {
          slotKey: doc.documentType,
          documentDbId: doc.id,
          storageKey: doc.s3Key,
          filename: doc.filename,
          mimeType: doc.mimeType,
        });
      }
    }
  }

  if (!matched) return null;

  return {
    profileId,
    name: name || 'Traveller',
    passportData,
    tripDetails,
    documents: Array.from(docsBySlot.values()),
  };
}
