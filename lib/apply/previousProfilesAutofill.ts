/**
 * Apply-step previous profiles + autofill from past visa applications (Postgres).
 * Per-listing component/question keys are random UUIDs, so we remap via:
 * - documents: catalog `documentType` (+ passport-front/back constants)
 * - extra answers: exact key when same listing, else normalized question label
 * IndexedDB is only used later to stage downloaded blobs for the new draft.
 */

import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';
import { travelerProfiles } from '@/lib/db/schema-traveler-profiles';
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
import { travelerProfileKey } from '@/lib/dashboard/travelerIdentity';
import {
  isApplicantVaultSlot,
  vaultDocumentIdentity,
} from '@/lib/dashboard/vaultDocumentTypes';
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

export type TravelerAutofillPayload = {
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

/** @deprecated Use TravelerAutofillPayload */
export type PassengerAutofillPayload = TravelerAutofillPayload;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

/**
 * Submitted (non-draft) applications only.
 * Drafts are in-progress work — never previous-profile / autofill sources.
 */
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
    .where(
      and(
        eq(visaApplications.userId, userId),
        ne(visaApplications.status, 'draft')
      )
    )
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
 * Source of truth: traveler_profiles (same as /documents). App history only
 * enriches counts / last visa label — never invents extra travellers.
 */
export async function getApplyPreviousProfiles(
  userId: string
): Promise<ApplyPreviousProfile[]> {
  const storedProfiles = await db
    .select({
      identityKey: travelerProfiles.identityKey,
      name: travelerProfiles.name,
      nationality: travelerProfiles.nationality,
      passportNumber: travelerProfiles.passportNumber,
      dateOfBirth: travelerProfiles.dateOfBirth,
    })
    .from(travelerProfiles)
    .where(eq(travelerProfiles.userId, userId));

  if (storedProfiles.length === 0) return [];

  const profiles = new Map<string, MutableApplyProfile>();
  for (const stored of storedProfiles) {
    if (!stored.identityKey.startsWith('npd:')) continue;
    profiles.set(stored.identityKey, {
      id: stored.identityKey,
      name: stored.name?.trim() || 'Traveller',
      nationality: stored.nationality?.trim() || null,
      applicationIds: new Set(),
      lastVisaLabel: 'Visa',
      lastCountryCode: 'IN',
    });
  }

  const apps = await loadUserVisaApps(userId);
  for (const app of apps) {
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    for (const traveller of travellers) {
      const id = travelerProfileKey(traveller);
      if (!id) continue;
      const existing = profiles.get(id);
      if (!existing) continue;
      existing.applicationIds.add(app.id);
      existing.lastVisaLabel = formatVisaTypeLabel(app.visaType || 'Visa');
      existing.lastCountryCode = (app.countryCode || 'IN').toUpperCase();
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
      applicationCount: Math.max(1, p.applicationIds.size),
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
 * Build autofill payload for a traveler profile against the current listing form.
 *
 * Documents: traveler vault only (same source as /documents).
 * Trip / richer passport: optional enrichment from past apps for this identity —
 * never path LIKE / never attach another traveller's files.
 */
export async function getTravelerAutofillForListing(input: {
  userId: string;
  profileId: string;
  formConfig: ApplyFormConfig;
}): Promise<TravelerAutofillPayload | null> {
  const { userId, profileId, formConfig } = input;

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
    if (slot.captureFace && !currentSlotByDocType.has('photo')) {
      currentSlotByDocType.set('photo', slot.key);
    }
  }

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

  let name = '';
  let passportData: IndianPassportFields | null = null;
  let tripDetails: TravellerTripDetails | null = null;
  const docsBySlot = new Map<string, AutofillDocumentRef>();

  const [storedProfileRow] = await db
    .select()
    .from(travelerProfiles)
    .where(
      and(
        eq(travelerProfiles.userId, userId),
        eq(travelerProfiles.identityKey, profileId)
      )
    )
    .limit(1);

  if (!storedProfileRow) return null;

  name = storedProfileRow.name?.trim() || name;
  if (storedProfileRow.passportNumber || storedProfileRow.dateOfBirth) {
    const sexRaw = (storedProfileRow.sex || '').trim();
    passportData = {
      passportNumber: storedProfileRow.passportNumber || '',
      surname: '',
      givenNames: '',
      nationality: storedProfileRow.nationality || 'IND',
      dateOfBirth: storedProfileRow.dateOfBirth || '',
      sex: sexRaw === 'M' || sexRaw === 'F' || sexRaw === 'X' ? sexRaw : '',
      dateOfExpiry: '',
      documentType: 'P',
      countryOfIssue: 'IND',
    };
  }

  const vaultDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.profileId, storedProfileRow.id),
        eq(documents.visibility, 'active')
      )
    )
    .orderBy(desc(documents.uploadedAt));

  for (const doc of vaultDocs) {
    if (!isApplicantVaultSlot(doc.documentType)) continue;
    const identity = vaultDocumentIdentity(doc.documentType, doc.documentType);
    const slotKey =
      currentSlotByDocType.get(identity) ||
      currentSlotByDocType.get(doc.documentType) ||
      (currentSlotKeys.has(doc.documentType) ? doc.documentType : null) ||
      (identity === 'passport-front' ||
      identity === 'passport-back' ||
      identity === 'photo'
        ? identity
        : null);
    if (!slotKey || docsBySlot.has(slotKey)) continue;
    rememberDoc(docsBySlot, {
      slotKey,
      documentDbId: doc.id,
      storageKey: doc.s3Key,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.fileSize ?? undefined,
      role: docRoleForSlotKey(slotKey, formConfig),
    });
  }

  // Trip answers (+ fuller passport MRZ) from past apps for this identity only.
  const apps = await loadUserVisaApps(userId);
  for (const app of apps) {
    const snapshot = parseFormSnapshot(app.formSnapshot);
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    if (travellers.length === 0) {
      const legacyKey = travelerProfileKey({
        passengerId: `legacy-${app.id}`,
        name: app.applicantName || 'Applicant',
      });
      if (!legacyKey || legacyKey !== profileId) continue;
      continue;
    }

    for (const traveller of travellers) {
      const key = travelerProfileKey(traveller);
      if (!key || key !== profileId) continue;
      if (!passportData) {
        passportData = toPassportFields(traveller.passportData);
      } else {
        const richer = toPassportFields(traveller.passportData);
        if (richer) {
          passportData = {
            ...passportData,
            surname: passportData.surname || richer.surname,
            givenNames: passportData.givenNames || richer.givenNames,
            dateOfExpiry: passportData.dateOfExpiry || richer.dateOfExpiry,
            sex: passportData.sex || richer.sex,
            nationality: passportData.nationality || richer.nationality,
          };
        }
      }
      tripDetails = mergeTripDetails(
        tripDetails,
        traveller.tripDetails,
        formConfig.extraQuestions,
        snapshot.extraQuestions
      );
    }
  }

  if (storedProfileRow.name?.trim()) {
    name = storedProfileRow.name.trim();
  }

  return {
    profileId,
    name: name || 'Traveller',
    passportData,
    tripDetails,
    documents: Array.from(docsBySlot.values()),
  };
}

/** @deprecated Use getTravelerAutofillForListing */
export const getPassengerAutofillForListing = getTravelerAutofillForListing;
