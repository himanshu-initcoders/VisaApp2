/**
 * Apply-step previous profiles + autofill from past visa applications (Postgres).
 * Per-listing component/question keys are random UUIDs, so we remap via:
 * - documents: catalog `documentType` (+ passport-front/back constants)
 * - extra answers: exact key when same listing, else normalized question label
 * IndexedDB is only used later to stage downloaded blobs for the new draft.
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
  /** Same-origin media URL after server stages the file into the current draft. */
  storageUrl?: string | null;
  filename: string;
  mimeType: string | null;
  size?: number;
  /** Helps client restore set passport/photo flags when slot keys are UUIDs. */
  role?: 'passport-front' | 'passport-back' | 'photo' | 'document';
};

export type PassengerAutofillPayload = {
  profileId: string;
  name: string;
  passportData: IndianPassportFields | null;
  tripDetails: TravellerTripDetails | null;
  documents: AutofillDocumentRef[];
  /** Draft refs ready for submit sync (no IndexedDB required). */
  draftFileRefs?: Array<{
    slotKey: string;
    storageKey: string;
    url?: string;
    mimeType: string;
    filename: string;
    size?: number;
  }>;
  passportFrontUrl?: string | null;
  passportBackUrl?: string | null;
  failedSlots?: string[];
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
  formSnapshot: unknown;
};

type SnapshotQuestion = {
  key?: string;
  label?: string;
  type?: string;
};

type SnapshotSlot = {
  key?: string;
  documentType?: string | null;
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
      formSnapshot: visaApplications.formSnapshot,
    })
    .from(visaApplications)
    .where(eq(visaApplications.userId, userId))
    .orderBy(desc(visaApplications.createdAt));
}

function normalizeQuestionLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseFormSnapshot(raw: unknown): {
  extraQuestions: SnapshotQuestion[];
  documentSlots: SnapshotSlot[];
} {
  if (!raw || typeof raw !== 'object') {
    return { extraQuestions: [], documentSlots: [] };
  }
  const snap = raw as {
    extraQuestions?: SnapshotQuestion[];
    documentSlots?: SnapshotSlot[];
  };
  return {
    extraQuestions: Array.isArray(snap.extraQuestions)
      ? snap.extraQuestions
      : [],
    documentSlots: Array.isArray(snap.documentSlots) ? snap.documentSlots : [],
  };
}

/**
 * Map a past application slot key (often a per-listing UUID) onto the current
 * listing's slot key using catalog documentType + stable passport slots.
 */
function resolveCurrentDocSlotKey(input: {
  pastSlotKey: string;
  pastSlots: SnapshotSlot[];
  currentSlotKeys: Set<string>;
  currentSlotByDocType: Map<string, string>;
}): string | null {
  const pastSlotKey = input.pastSlotKey.trim();
  if (!pastSlotKey) return null;

  // Same listing (or already-stable keys like passport-front / photo).
  if (input.currentSlotKeys.has(pastSlotKey)) return pastSlotKey;

  // Past row already stored a catalog type (or passport constant).
  const byTypeDirect = input.currentSlotByDocType.get(pastSlotKey);
  if (byTypeDirect) return byTypeDirect;

  const pastMeta = input.pastSlots.find((slot) => slot.key === pastSlotKey);
  const docType = str(pastMeta?.documentType);
  if (!docType) return null;

  if (input.currentSlotKeys.has(docType)) return docType;
  return input.currentSlotByDocType.get(docType) ?? null;
}

/**
 * Remap past extra answers onto current question keys.
 * Prefer exact key (same listing); otherwise match normalized labels.
 */
function mergeExtraAnswers(input: {
  currentExtra: Record<string, string>;
  incomingExtra: Record<string, unknown>;
  currentQuestions: ApplyFormConfig['extraQuestions'];
  pastQuestions: SnapshotQuestion[];
}): Record<string, string> {
  const next = { ...input.currentExtra };
  const currentKeys = new Set(input.currentQuestions.map((q) => q.key));
  const currentKeyByLabel = new Map<string, string>();
  for (const question of input.currentQuestions) {
    const label = normalizeQuestionLabel(question.label || '');
    if (label && !currentKeyByLabel.has(label)) {
      currentKeyByLabel.set(label, question.key);
    }
  }

  const pastLabelByKey = new Map<string, string>();
  for (const question of input.pastQuestions) {
    const key = str(question.key);
    const label = normalizeQuestionLabel(str(question.label));
    if (key && label) pastLabelByKey.set(key, label);
  }

  for (const [pastKey, rawValue] of Object.entries(input.incomingExtra)) {
    const value = str(rawValue);
    if (!value) continue;

    if (currentKeys.has(pastKey)) {
      if (!next[pastKey]?.trim()) next[pastKey] = value;
      continue;
    }

    const pastLabel = pastLabelByKey.get(pastKey);
    if (!pastLabel) continue;
    const currentKey = currentKeyByLabel.get(pastLabel);
    if (!currentKey || next[currentKey]?.trim()) continue;
    next[currentKey] = value;
  }

  return next;
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
  currentQuestions: ApplyFormConfig['extraQuestions'],
  pastQuestions: SnapshotQuestion[]
): TravellerTripDetails {
  const base = current ?? emptyTripDetails();
  if (!incoming) return base;

  const incomingExtra =
    incoming.extra && typeof incoming.extra === 'object'
      ? (incoming.extra as Record<string, unknown>)
      : {};

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
    extra: mergeExtraAnswers({
      currentExtra: { ...base.extra },
      incomingExtra,
      currentQuestions,
      pastQuestions,
    }),
  });

  return next;
}

function docRoleForSlotKey(
  slotKey: string,
  formConfig: ApplyFormConfig
): AutofillDocumentRef['role'] {
  if (slotKey === PASSPORT_FRONT_SLOT) return 'passport-front';
  if (slotKey === PASSPORT_BACK_SLOT) return 'passport-back';
  if (slotKey === 'photo') return 'photo';
  const slot = formConfig.documentSlots.find((item) => item.key === slotKey);
  if (
    slot?.captureFace ||
    slot?.documentType === 'photo' ||
    slot?.key === 'photo'
  ) {
    return 'photo';
  }
  return 'document';
}

function rememberDoc(
  docsBySlot: Map<string, AutofillDocumentRef>,
  ref: AutofillDocumentRef
) {
  const existing = docsBySlot.get(ref.slotKey);
  if (!existing) {
    docsBySlot.set(ref.slotKey, ref);
    return;
  }
  // Prefer a documents-table row id when we only had traveller JSON before.
  if (!existing.documentDbId && ref.documentDbId) {
    docsBySlot.set(ref.slotKey, { ...existing, ...ref, role: ref.role || existing.role });
  }
}

/**
 * Build autofill payload for a passenger profile against the current listing form.
 * Source of truth: past visa applications in Postgres (not IndexedDB).
 * Newest applications win; older apps only fill gaps.
 * Docs/questions match by stable documentType / question label across listings.
 */
export async function getPassengerAutofillForListing(input: {
  userId: string;
  profileId: string;
  formConfig: ApplyFormConfig;
}): Promise<PassengerAutofillPayload | null> {
  const { userId, profileId, formConfig } = input;
  const apps = await loadUserVisaApps(userId);
  if (apps.length === 0) return null;

  const currentSlotKeys = new Set([
    ...formConfig.documentSlots.map((s) => s.key),
    PASSPORT_FRONT_SLOT,
    PASSPORT_BACK_SLOT,
  ]);

  /** Catalog documentType → first current slot key that needs that type. */
  const currentSlotByDocType = new Map<string, string>();

  for (const slot of formConfig.documentSlots) {
    const docType = str(slot.documentType);
    if (docType && !currentSlotByDocType.has(docType)) {
      currentSlotByDocType.set(docType, slot.key);
    }
    // Face-capture slots are the listing's passport photo even if type differs.
    if (slot.captureFace && !currentSlotByDocType.has('photo')) {
      currentSlotByDocType.set('photo', slot.key);
    }
  }

  // Stable passport / photo fallbacks when the listing has no matching slot row.
  const passportFallbacks: Array<[string, string]> = [
    [PASSPORT_FRONT_SLOT, PASSPORT_FRONT_SLOT],
    [PASSPORT_BACK_SLOT, PASSPORT_BACK_SLOT],
    ['passport', PASSPORT_FRONT_SLOT],
    ['passport_back', PASSPORT_BACK_SLOT],
    ['photo', 'photo'],
  ];
  for (const [docType, slotKey] of passportFallbacks) {
    if (!currentSlotByDocType.has(docType)) {
      currentSlotByDocType.set(docType, slotKey);
    }
  }

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
    const snapshot = parseFormSnapshot(app.formSnapshot);
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    const resolveSlot = (pastSlotKey: string) =>
      resolveCurrentDocSlotKey({
        pastSlotKey,
        pastSlots: snapshot.documentSlots,
        currentSlotKeys,
        currentSlotByDocType,
      });

    if (travellers.length === 0) {
      const legacyKey = passengerProfileKey({
        passengerId: `legacy-${app.id}`,
        name: app.applicantName || 'Applicant',
      });
      if (legacyKey !== profileId) continue;
      matched = true;
      if (!name) name = app.applicantName || 'Applicant';

      for (const doc of docsByApp.get(app.id) ?? []) {
        const slotKey = resolveSlot(doc.documentType);
        if (!slotKey || docsBySlot.has(slotKey)) continue;
        rememberDoc(docsBySlot, {
          slotKey,
          documentDbId: doc.id,
          storageKey: doc.s3Key,
          filename: doc.filename,
          mimeType: doc.mimeType,
          role: docRoleForSlotKey(slotKey, formConfig),
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
        formConfig.extraQuestions,
        snapshot.extraQuestions
      );

      for (const tdoc of traveller.documents ?? []) {
        const pastKey = tdoc.slotKey || '';
        const slotKey = resolveSlot(pastKey);
        if (!slotKey || docsBySlot.has(slotKey)) continue;
        if (!tdoc.key && !tdoc.url) continue;
        rememberDoc(docsBySlot, {
          slotKey,
          documentDbId: null,
          storageKey: tdoc.key || null,
          filename: tdoc.filename || `${slotKey}.bin`,
          mimeType: tdoc.mimeType || null,
          role: docRoleForSlotKey(slotKey, formConfig),
        });
      }

      for (const doc of docsByApp.get(app.id) ?? []) {
        const slotKey = resolveSlot(doc.documentType);
        if (!slotKey) continue;
        const passengerId = extractPassengerIdFromKey(doc.s3Key);
        if (
          traveller.passengerId &&
          passengerId &&
          passengerId !== traveller.passengerId
        ) {
          continue;
        }
        rememberDoc(docsBySlot, {
          slotKey,
          documentDbId: doc.id,
          storageKey: doc.s3Key,
          filename: doc.filename,
          mimeType: doc.mimeType,
          role: docRoleForSlotKey(slotKey, formConfig),
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
