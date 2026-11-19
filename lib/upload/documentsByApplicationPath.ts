/**
 * Find documents rows whose storage key is under a given application id path.
 *
 * Prefer JSON attachment refs for applicant docs. Use this helper for:
 * - staff outcome slots (visa_outcome / passport_outcome)
 * - draft delete cleanup
 * Do not use as the primary read path for submitted traveller documents.
 */

import { and, eq, like, or, sql } from 'drizzle-orm';
import { documents, type Document } from '@/lib/db/schema';

type DbLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
};

export function applicationPathPattern(applicationId: string): string {
  return `%/${applicationId}/%`;
}

export async function listDocumentsForApplicationPath(
  tx: DbLike,
  applicationId: string,
  opts?: {
    documentType?: string;
    documentTypes?: string[];
  }
): Promise<Document[]> {
  const pattern = applicationPathPattern(applicationId);
  const typeFilter = opts?.documentType
    ? eq(documents.documentType, opts.documentType)
    : opts?.documentTypes && opts.documentTypes.length > 0
      ? or(
          ...opts.documentTypes.map((t) => eq(documents.documentType, t))
        )
      : undefined;

  const rows = await tx
    .select()
    .from(documents)
    .where(
      typeFilter
        ? and(like(documents.s3Key, pattern), typeFilter)
        : like(documents.s3Key, pattern)
    );

  return rows as Document[];
}

/** SQL fragment for joins: documents.s3_key contains /{applicationId}/ */
export function documentsS3KeyContainsApplicationId(
  applicationIdColumn: ReturnType<typeof sql> | unknown
) {
  return sql`${documents.s3Key} LIKE ${sql`'%' || ${applicationIdColumn} || '%'`}`;
}
