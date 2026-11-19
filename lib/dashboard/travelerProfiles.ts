import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';
import { travelerProfiles } from '@/lib/db/schema-traveler-profiles';
import { componentsRequired } from '@/lib/db/schema-extended';
import { resolveDocumentSlotLabel } from '@/lib/apply/applicationForm';
import { documentTypeLabel } from '@/lib/document-types';
import { uploadService } from '@/lib/upload';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';
import {
  isApplicantVaultSlot,
  vaultDocumentIdentity,
} from '@/lib/dashboard/vaultDocumentTypes';
import { travelerProfileKey } from '@/lib/dashboard/travelerIdentity';

export { travelerProfileKey } from '@/lib/dashboard/travelerIdentity';

type StoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
};

export type TravelerProfileDocument = {
  id: string;
  /** Row id in `documents` when available — used for secure preview. */
  documentDbId: string | null;
  /** Storage object key when known — used to dedupe traveller JSON vs documents table. */
  storageKey: string | null;
  slotKey: string;
  /** Stable vault identity (catalog type or passport-front / photo). */
  vaultType: string;
  label: string;
  filename: string;
  mimeType: string | null;
  previewUrl: string | null;
  applicationId: string;
  applicationLabel: string;
  uploadedAt: string | null;
  verified: boolean | null;
  /** Applicant personal docs only — never outcomes. */
  canReplace: boolean;
};

export type TravelerProfile = {
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
  documents: TravelerProfileDocument[];
};

function applicationLabel(app: {
  country?: string | null;
  countryCode?: string | null;
  visaType?: string | null;
}): string {
  const country = app.country || app.countryCode || 'Visa';
  return `${country} · ${app.visaType || 'Application'}`;
}

async function buildSlotMetaMap(
  slotKeys: Iterable<string>
): Promise<{
  labelBySlotKey: Map<string, string>;
  catalogBySlotKey: Map<string, string>;
}> {
  const unique = Array.from(
    new Set(
      Array.from(slotKeys)
        .map((key) => key.trim())
        .filter(Boolean)
    )
  );
  const labelBySlotKey = new Map<string, string>();
  const catalogBySlotKey = new Map<string, string>();
  if (unique.length === 0) return { labelBySlotKey, catalogBySlotKey };

  const rows = await db
    .select({
      key: componentsRequired.key,
      label: componentsRequired.label,
      documentType: componentsRequired.documentType,
    })
    .from(componentsRequired)
    .where(inArray(componentsRequired.key, unique));

  for (const row of rows) {
    const key = row.key?.trim();
    if (!key) continue;
    const catalog = row.documentType?.trim() || '';
    if (catalog && !catalogBySlotKey.has(key)) {
      catalogBySlotKey.set(key, catalog);
    }
    if (labelBySlotKey.has(key)) continue;
    const label =
      row.label?.trim() ||
      (catalog ? documentTypeLabel(catalog) : '') ||
      '';
    if (label) labelBySlotKey.set(key, label);
  }

  return { labelBySlotKey, catalogBySlotKey };
}

function labelForSlot(
  slotKey: string,
  labelBySlotKey: Map<string, string>,
  catalogBySlotKey: Map<string, string>
): string {
  const key = slotKey.trim();
  const catalog = catalogBySlotKey.get(key);
  if (catalog) return documentTypeLabel(catalog);
  return labelBySlotKey.get(key) || resolveDocumentSlotLabel(key);
}

/**
 * Load persisted traveler profiles + active vault documents for the user.
 */
export async function getTravelerProfilesForUser(
  userId: string
): Promise<TravelerProfile[]> {
  const profiles = await db
    .select()
    .from(travelerProfiles)
    .where(eq(travelerProfiles.userId, userId));

  if (profiles.length === 0) return [];

  const profileIds = profiles.map((p) => p.id);
  const identityToProfile = new Map(
    profiles.map((p) => [p.identityKey, p.id] as const)
  );

  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        inArray(documents.profileId, profileIds),
        eq(documents.visibility, 'active')
      )
    )
    .orderBy(desc(documents.uploadedAt));

  const apps = await db
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

  const appsByProfile = new Map<
    string,
    Map<string, { id: string; label: string; country: string | null }>
  >();

  for (const app of apps) {
    const label = applicationLabel(app);
    const country = app.country || app.countryCode || null;
    const travellers: StoredTraveller[] = Array.isArray(app.travellers)
      ? (app.travellers as StoredTraveller[])
      : [];

    const link = (profileId: string) => {
      const map = appsByProfile.get(profileId) ?? new Map();
      map.set(app.id, { id: app.id, label, country });
      appsByProfile.set(profileId, map);
    };

    if (travellers.length === 0) {
      const legacyKey = travelerProfileKey({
        passengerId: `legacy-${app.id}`,
        name: app.applicantName || 'Applicant',
      });
      if (!legacyKey) continue;
      const profileId = identityToProfile.get(legacyKey);
      if (profileId) link(profileId);
      continue;
    }

    for (const traveller of travellers) {
      const key = travelerProfileKey(traveller);
      if (!key) continue;
      const profileId = identityToProfile.get(key);
      if (profileId) link(profileId);
    }
  }

  const slotKeys = new Set(docs.map((d) => d.documentType).filter(Boolean));
  const { labelBySlotKey, catalogBySlotKey } = await buildSlotMetaMap(slotKeys);

  return profiles
    .map((profile) => {
      const linkedApps = Array.from(
        (appsByProfile.get(profile.id) ?? new Map()).values()
      );
      // Applicant personal docs only — exclude staff outcomes, etc.
      const byVaultType = new Map<string, TravelerProfileDocument>();

      for (const doc of docs) {
        if (doc.profileId !== profile.id) continue;
        if (!isApplicantVaultSlot(doc.documentType)) continue;

        const catalog = catalogBySlotKey.get(doc.documentType) || null;
        const vaultType = vaultDocumentIdentity(doc.documentType, catalog);
        const uploadedAt = doc.uploadedAt?.toISOString?.() ?? null;
        const existing = byVaultType.get(vaultType);
        const existingTime = existing?.uploadedAt
          ? new Date(existing.uploadedAt).getTime()
          : 0;
        const nextTime = uploadedAt ? new Date(uploadedAt).getTime() : 0;
        if (existing && existingTime >= nextTime) continue;

        byVaultType.set(vaultType, {
          id: doc.id,
          documentDbId: doc.id,
          storageKey: doc.s3Key,
          slotKey: doc.documentType,
          vaultType,
          label: labelForSlot(
            doc.documentType,
            labelBySlotKey,
            catalogBySlotKey
          ),
          filename: doc.filename,
          mimeType: doc.mimeType,
          previewUrl:
            toAppMediaUrl(doc.s3Key) || uploadService.getUrl(doc.s3Key),
          applicationId: '',
          applicationLabel: 'Personal document',
          uploadedAt,
          verified: doc.verified,
          canReplace: true,
        });
      }

      const profileDocs = Array.from(byVaultType.values()).sort((a, b) => {
        const at = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const bt = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return bt - at;
      });

      return {
        id: profile.id,
        name: profile.name,
        passportNumber: profile.passportNumber,
        dateOfBirth: profile.dateOfBirth,
        nationality: profile.nationality,
        sex: profile.sex,
        applicationCount: linkedApps.length,
        applications: linkedApps,
        documents: profileDocs,
      } satisfies TravelerProfile;
    })
    .filter((p) => p.documents.length > 0 || p.applicationCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
