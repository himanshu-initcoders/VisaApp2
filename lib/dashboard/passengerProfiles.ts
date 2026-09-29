import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';
import { formatDocumentTitle } from '@/lib/apply/applicationForm';
import { uploadService } from '@/lib/upload';

type StoredTravellerDoc = {
  slotKey?: string;
  key?: string;
  url?: string;
  mimeType?: string;
  filename?: string;
  size?: number;
};

type StoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  documents?: StoredTravellerDoc[] | null;
};

export type PassengerProfileDocument = {
  id: string;
  /** Row id in `documents` when available — used for secure preview. */
  documentDbId: string | null;
  /** Storage object key when known — used to dedupe traveller JSON vs documents table. */
  storageKey: string | null;
  slotKey: string;
  label: string;
  filename: string;
  mimeType: string | null;
  previewUrl: string | null;
  applicationId: string;
  applicationLabel: string;
  uploadedAt: string | null;
  verified: boolean | null;
};

export type PassengerProfile = {
  id: string;
  name: string;
  passportNumber: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  sex: string | null;
  applicationCount: number;
  applications: Array<{
    id: string;
    label: string;
    country: string | null;
  }>;
  documents: PassengerProfileDocument[];
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePassport(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

/**
 * Stable identity across applications: passport number first,
 * then name+DOB, then passenger id (per-application fallback).
 */
export function passengerProfileKey(traveller: StoredTraveller): string {
  const passport = traveller.passportData || {};
  const passportNumber = normalizePassport(str(passport.passportNumber));
  if (passportNumber) return `pp:${passportNumber}`;

  const dob = str(passport.dateOfBirth);
  const name = displayName(traveller).toLowerCase();
  if (name && dob) return `nd:${name}|${dob}`;
  if (name && name !== 'traveller') return `n:${name}`;

  const passengerId = str(traveller.passengerId);
  return passengerId ? `id:${passengerId}` : `id:unknown`;
}

function extractPassengerIdFromKey(s3Key: string): string | null {
  const match = s3Key.match(/\/passengers\/([^/]+)\//);
  return match?.[1] ?? null;
}

function applicationLabel(app: {
  country?: string | null;
  countryCode?: string | null;
  visaType?: string | null;
}): string {
  const country = app.country || app.countryCode || 'Visa';
  return `${country} · ${app.visaType || 'Application'}`;
}

type MutableProfile = {
  id: string;
  name: string;
  passportNumber: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  sex: string | null;
  passengerIds: Set<string>;
  applications: Map<string, { id: string; label: string; country: string | null }>;
  documents: Map<string, PassengerProfileDocument>;
};

function ensureProfile(
  profiles: Map<string, MutableProfile>,
  traveller: StoredTraveller
): MutableProfile {
  const id = passengerProfileKey(traveller);
  const passport = traveller.passportData || {};
  const existing = profiles.get(id);
  if (existing) {
    const nextName = displayName(traveller);
    if (nextName && nextName !== 'Traveller') existing.name = nextName;
    if (!existing.passportNumber) {
      const pn = normalizePassport(str(passport.passportNumber));
      existing.passportNumber = pn || null;
    }
    if (!existing.dateOfBirth) {
      existing.dateOfBirth = str(passport.dateOfBirth) || null;
    }
    if (!existing.nationality) {
      existing.nationality = str(passport.nationality) || null;
    }
    if (!existing.sex) {
      existing.sex = str(passport.sex) || null;
    }
    if (traveller.passengerId) {
      existing.passengerIds.add(traveller.passengerId);
    }
    return existing;
  }

  const pn = normalizePassport(str(passport.passportNumber));
  const created: MutableProfile = {
    id,
    name: displayName(traveller),
    passportNumber: pn || null,
    dateOfBirth: str(passport.dateOfBirth) || null,
    nationality: str(passport.nationality) || null,
    sex: str(passport.sex) || null,
    passengerIds: new Set(
      traveller.passengerId ? [traveller.passengerId] : []
    ),
    applications: new Map(),
    documents: new Map(),
  };
  profiles.set(id, created);
  return created;
}

function addDocument(
  profile: MutableProfile,
  doc: PassengerProfileDocument
) {
  const dedupeKey =
    doc.storageKey ||
    doc.documentDbId ||
    `${doc.applicationId}:${doc.slotKey}:${doc.filename}`;

  const existing = profile.documents.get(dedupeKey);
  if (existing) {
    // Prefer documents-table metadata when merging the same file twice
    profile.documents.set(dedupeKey, {
      ...existing,
      ...doc,
      documentDbId: doc.documentDbId || existing.documentDbId,
      storageKey: doc.storageKey || existing.storageKey,
      uploadedAt: doc.uploadedAt || existing.uploadedAt,
      verified:
        doc.verified !== null && doc.verified !== undefined
          ? doc.verified
          : existing.verified,
    });
    return;
  }

  // Same app + slot without a shared storage key (rare)
  for (const [key, other] of profile.documents) {
    if (
      other.applicationId === doc.applicationId &&
      other.slotKey === doc.slotKey &&
      (other.filename === doc.filename ||
        (other.storageKey &&
          doc.storageKey &&
          other.storageKey === doc.storageKey))
    ) {
      profile.documents.set(key, {
        ...other,
        ...doc,
        documentDbId: doc.documentDbId || other.documentDbId,
        storageKey: doc.storageKey || other.storageKey,
      });
      return;
    }
  }

  profile.documents.set(dedupeKey, doc);
}

/**
 * Auto-build passenger profiles from the user's submitted visa applications.
 * Unique by passport number (fallback: name + DOB / name / passenger id).
 */
export async function getPassengerProfilesForUser(
  userId: string
): Promise<PassengerProfile[]> {
  const apps = await db
    .select({
      id: visaApplications.id,
      country: visaApplications.country,
      countryCode: visaApplications.countryCode,
      visaType: visaApplications.visaType,
      travellers: visaApplications.travellers,
      applicantName: visaApplications.applicantName,
      submittedAt: visaApplications.submittedAt,
      createdAt: visaApplications.createdAt,
    })
    .from(visaApplications)
    .where(eq(visaApplications.userId, userId))
    .orderBy(desc(visaApplications.createdAt));

  if (apps.length === 0) return [];

  const appIds = apps.map((a) => a.id);
  const dbDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        inArray(documents.applicationId, appIds),
        eq(documents.applicationType, 'visa')
      )
    )
    .orderBy(desc(documents.uploadedAt));

  const docsByApp = new Map<string, typeof dbDocs>();
  for (const doc of dbDocs) {
    const list = docsByApp.get(doc.applicationId) ?? [];
    list.push(doc);
    docsByApp.set(doc.applicationId, list);
  }

  const profiles = new Map<string, MutableProfile>();
  /** passengerId → profile id (for matching documents table rows) */
  const passengerIdToProfile = new Map<string, string>();

  for (const app of apps) {
    const label = applicationLabel(app);
    const country = app.country || app.countryCode || null;
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    if (travellers.length === 0) {
      // Legacy single-applicant row — still surface a profile + docs
      const legacy: StoredTraveller = {
        passengerId: `legacy-${app.id}`,
        name: app.applicantName || 'Applicant',
        passportData: null,
        documents: [],
      };
      const profile = ensureProfile(profiles, legacy);
      profile.applications.set(app.id, { id: app.id, label, country });
      passengerIdToProfile.set(legacy.passengerId!, profile.id);

      for (const doc of docsByApp.get(app.id) ?? []) {
        addDocument(profile, {
          id: doc.id,
          documentDbId: doc.id,
          storageKey: doc.s3Key,
          slotKey: doc.documentType,
          label: formatDocumentTitle(doc.documentType),
          filename: doc.filename,
          mimeType: doc.mimeType,
          previewUrl: uploadService.getUrl(doc.s3Key),
          applicationId: app.id,
          applicationLabel: label,
          uploadedAt: doc.uploadedAt?.toISOString?.() ?? null,
          verified: doc.verified,
        });
      }
      continue;
    }

    for (const traveller of travellers) {
      const profile = ensureProfile(profiles, traveller);
      profile.applications.set(app.id, { id: app.id, label, country });
      if (traveller.passengerId) {
        passengerIdToProfile.set(traveller.passengerId, profile.id);
      }

      for (const tdoc of traveller.documents ?? []) {
        const slotKey = tdoc.slotKey || 'document';
        const key = tdoc.key || null;
        const previewUrl = key
          ? uploadService.getUrl(key)
          : tdoc.url || null;
        addDocument(profile, {
          id: key || `${app.id}:${slotKey}:${tdoc.filename || 'file'}`,
          documentDbId: null,
          storageKey: key,
          slotKey,
          label: formatDocumentTitle(slotKey),
          filename: tdoc.filename || slotKey,
          mimeType: tdoc.mimeType || null,
          previewUrl,
          applicationId: app.id,
          applicationLabel: label,
          uploadedAt: null,
          verified: null,
        });
      }
    }

    // Attach documents-table rows via passenger id in the storage path
    for (const doc of docsByApp.get(app.id) ?? []) {
      const passengerId = extractPassengerIdFromKey(doc.s3Key);
      const profileId = passengerId
        ? passengerIdToProfile.get(passengerId)
        : null;
      const profile = profileId
        ? profiles.get(profileId)
        : // Single-traveller apps: attach unmatched docs to the only profile on this app
          travellers.length === 1
          ? profiles.get(passengerProfileKey(travellers[0]))
          : null;

      if (!profile) continue;

      addDocument(profile, {
        id: doc.id,
        documentDbId: doc.id,
        storageKey: doc.s3Key,
        slotKey: doc.documentType,
        label: formatDocumentTitle(doc.documentType),
        filename: doc.filename,
        mimeType: doc.mimeType,
        previewUrl: uploadService.getUrl(doc.s3Key),
        applicationId: app.id,
        applicationLabel: label,
        uploadedAt: doc.uploadedAt?.toISOString?.() ?? null,
        verified: doc.verified,
      });
    }
  }

  return Array.from(profiles.values())
    .map((p) => ({
      id: p.id,
      name: p.name,
      passportNumber: p.passportNumber,
      dateOfBirth: p.dateOfBirth,
      nationality: p.nationality,
      sex: p.sex,
      applicationCount: p.applications.size,
      applications: Array.from(p.applications.values()),
      documents: Array.from(p.documents.values()).sort((a, b) => {
        const at = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const bt = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return bt - at;
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
