/**
 * Application document attachments — frozen at submit/correction time.
 *
 * Source of truth: travellers[].documents[] (+ summary documents[]) refs
 * { documentId?, key, slotKey }. Vault library updates must never rewrite these.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  documents,
  passportServices,
  visaApplications,
  type Document,
} from '@/lib/db/schema';
import { isOutcomeDocumentSlot } from '@/lib/visa/outcomeDocumentShared';
import {
  applicationPathPattern,
  listDocumentsForApplicationPath,
} from '@/lib/upload/documentsByApplicationPath';

export type AttachmentRef = {
  documentId: string | null;
  key: string | null;
  slotKey: string | null;
  passengerId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pushDocRefs(
  target: AttachmentRef[],
  value: unknown,
  passengerId: string | null
) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    const doc = asRecord(item);
    if (!doc) continue;
    const documentId =
      typeof doc.documentId === 'string' && doc.documentId.trim()
        ? doc.documentId.trim()
        : null;
    const key =
      typeof doc.key === 'string' && doc.key.trim() ? doc.key.trim() : null;
    const slotKey =
      typeof doc.slotKey === 'string' && doc.slotKey.trim()
        ? doc.slotKey.trim()
        : null;
    const nestedPassenger =
      typeof doc.passengerId === 'string' && doc.passengerId.trim()
        ? doc.passengerId.trim()
        : null;
    if (!documentId && !key) continue;
    target.push({
      documentId,
      key,
      slotKey,
      passengerId: nestedPassenger || passengerId,
    });
  }
}

/** Collect frozen attachment refs from a visa or passport application payload. */
export function collectAttachmentRefs(application: {
  travellers?: unknown;
  documents?: unknown;
}): AttachmentRef[] {
  const refs: AttachmentRef[] = [];

  if (Array.isArray(application.travellers)) {
    for (const traveller of application.travellers) {
      const row = asRecord(traveller);
      if (!row) continue;
      const passengerId =
        typeof row.passengerId === 'string' && row.passengerId.trim()
          ? row.passengerId.trim()
          : null;
      pushDocRefs(refs, row.documents, passengerId);
    }
  }

  // Summary list (may duplicate traveller docs — fine, we dedupe by id/key)
  pushDocRefs(refs, application.documents, null);
  return refs;
}

/**
 * Load documents that belong to an application:
 * 1) Frozen JSON refs (documentId / storage key)
 * 2) Staff outcome rows under the application storage path
 * 3) Legacy fallback: application-path objects under this applicationId
 *
 * Never returns vault-only library rows (users/... with no JSON ref).
 */
export async function loadDocumentsForApplication(input: {
  applicationId: string;
  applicationType: 'visa' | 'passport';
}): Promise<Document[]> {
  const { applicationId, applicationType } = input;

  let travellers: unknown = null;
  let summaryDocs: unknown = null;

  if (applicationType === 'visa') {
    const [app] = await db
      .select({
        travellers: visaApplications.travellers,
        documents: visaApplications.documents,
      })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1);
    travellers = app?.travellers ?? null;
    summaryDocs = app?.documents ?? null;
  } else {
    const [app] = await db
      .select({
        documents: passportServices.documents,
      })
      .from(passportServices)
      .where(eq(passportServices.id, applicationId))
      .limit(1);
    summaryDocs = app?.documents ?? null;
  }

  const refs = collectAttachmentRefs({ travellers, documents: summaryDocs });
  const documentIds = [
    ...new Set(
      refs
        .map((r) => r.documentId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const storageKeys = [
    ...new Set(
      refs.map((r) => r.key).filter((key): key is string => Boolean(key))
    ),
  ];

  const byRef: Document[] = [];
  if (documentIds.length > 0) {
    const rows = await db
      .select()
      .from(documents)
      .where(inArray(documents.id, documentIds));
    byRef.push(...rows);
  }
  if (storageKeys.length > 0) {
    const rows = await db
      .select()
      .from(documents)
      .where(inArray(documents.s3Key, storageKeys));
    byRef.push(...rows);
  }

  // Outcomes are staff-attached and may not appear in travellers JSON —
  // path lookup is scoped to outcome slots only (not all applicant docs).
  const pathDocs = await listDocumentsForApplicationPath(db, applicationId, {
    documentTypes: ['visa_outcome', 'passport_outcome'],
  });

  const bestOutcomes = new Map<string, Document>();
  for (const row of pathDocs) {
    if (!isOutcomeDocumentSlot(row.documentType)) continue;
    const existing = bestOutcomes.get(row.documentType);
    const preferAppPath =
      row.s3Key.startsWith('applications/') &&
      (!existing || !existing.s3Key.startsWith('applications/'));
    const newer =
      existing &&
      row.uploadedAt.getTime() > existing.uploadedAt.getTime() &&
      row.s3Key.startsWith('applications/') ===
        existing.s3Key.startsWith('applications/');
    if (!existing || preferAppPath || newer) {
      if (
        existing?.s3Key.startsWith('applications/') &&
        row.s3Key.startsWith('users/')
      ) {
        continue;
      }
      bestOutcomes.set(row.documentType, row);
    }
  }

  const merged = new Map<string, Document>();
  for (const row of [...byRef, ...bestOutcomes.values()]) {
    // Skip pure vault library rows that were not referenced by JSON.
    if (
      row.s3Key.startsWith('users/') &&
      !storageKeys.includes(row.s3Key) &&
      !documentIds.includes(row.id)
    ) {
      continue;
    }
    merged.set(row.id, row);
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
  );
}

/** Convenience: rows whose s3_key contains /{applicationId}/ */
export async function listDocumentsByApplicationIdPath(
  applicationId: string
): Promise<Document[]> {
  return listDocumentsForApplicationPath(db, applicationId);
}

export { applicationPathPattern };
