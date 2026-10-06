import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, visaApplications } from '@/lib/db/schema';

/**
 * Reviewers may only read or change visa applications assigned to them.
 */
export async function reviewerOwnsVisa(
  reviewerId: string,
  applicationId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: visaApplications.id })
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.id, applicationId),
        eq(visaApplications.assignedReviewerId, reviewerId)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function reviewerOwnsDocument(
  reviewerId: string,
  documentId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .innerJoin(
      visaApplications,
      and(
        eq(documents.applicationId, visaApplications.id),
        eq(documents.applicationType, 'visa')
      )
    )
    .where(
      and(
        eq(documents.id, documentId),
        eq(visaApplications.assignedReviewerId, reviewerId)
      )
    )
    .limit(1);

  return Boolean(row);
}
