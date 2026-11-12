import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, passportServices, visaApplications } from '@/lib/db/schema';

/**
 * Reviewers may only read or change applications assigned to them.
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

export async function reviewerOwnsPassport(
  reviewerId: string,
  applicationId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: passportServices.id })
    .from(passportServices)
    .where(
      and(
        eq(passportServices.id, applicationId),
        eq(passportServices.assignedReviewerId, reviewerId)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function reviewerOwnsApplication(
  reviewerId: string,
  applicationId: string,
  applicationType: 'visa' | 'passport'
): Promise<boolean> {
  if (applicationType === 'passport') {
    return reviewerOwnsPassport(reviewerId, applicationId);
  }
  return reviewerOwnsVisa(reviewerId, applicationId);
}

export async function reviewerOwnsDocument(
  reviewerId: string,
  documentId: string
): Promise<boolean> {
  const [visaDoc] = await db
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

  if (visaDoc) return true;

  const [passportDoc] = await db
    .select({ id: documents.id })
    .from(documents)
    .innerJoin(
      passportServices,
      and(
        eq(documents.applicationId, passportServices.id),
        eq(documents.applicationType, 'passport')
      )
    )
    .where(
      and(
        eq(documents.id, documentId),
        eq(passportServices.assignedReviewerId, reviewerId)
      )
    )
    .limit(1);

  return Boolean(passportDoc);
}
