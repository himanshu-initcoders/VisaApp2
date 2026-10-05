/**
 * Database helpers for per-traveller visa status.
 * Pure rollup rules live in caseStatus.ts so client components can import them.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  visaApplicationTravellers,
  visaApplications,
} from '@/lib/db/schema';
import { rollupCaseStatus } from '@/lib/visa/caseStatus';

export interface TravellerStatusSummary {
  travellerCount: number;
  approvedCount: number;
}

export async function loadTravellerSummaries(
  applicationIds: string[]
): Promise<Map<string, TravellerStatusSummary>> {
  const map = new Map<string, TravellerStatusSummary>();
  if (applicationIds.length === 0) return map;

  const rows = await db
    .select({
      applicationId: visaApplicationTravellers.applicationId,
      status: visaApplicationTravellers.status,
    })
    .from(visaApplicationTravellers)
    .where(inArray(visaApplicationTravellers.applicationId, applicationIds));

  for (const row of rows) {
    const current = map.get(row.applicationId) ?? {
      travellerCount: 0,
      approvedCount: 0,
    };
    current.travellerCount += 1;
    if (row.status === 'approved') current.approvedCount += 1;
    map.set(row.applicationId, current);
  }

  return map;
}

/** Rewrite visa_applications.status from the traveller rows. */
export async function recomputeVisaCaseStatus(
  applicationId: string
): Promise<void> {
  const [travellers, application] = await Promise.all([
    db
      .select({ status: visaApplicationTravellers.status })
      .from(visaApplicationTravellers)
      .where(eq(visaApplicationTravellers.applicationId, applicationId)),
    db
      .select({
        reviewedAt: visaApplications.reviewedAt,
        completedAt: visaApplications.completedAt,
      })
      .from(visaApplications)
      .where(eq(visaApplications.id, applicationId))
      .limit(1),
  ]);

  const current = application[0];
  if (!current) return;

  const rollup = rollupCaseStatus(travellers.map((row) => row.status));
  const now = new Date();

  await db
    .update(visaApplications)
    .set({
      status: rollup.status,
      updatedAt: now,
      ...(rollup.setReviewedAt && !current.reviewedAt
        ? { reviewedAt: now }
        : {}),
      ...(rollup.setCompletedAt
        ? { completedAt: current.completedAt ?? now }
        : {}),
      ...(rollup.clearCompletedAt ? { completedAt: null } : {}),
    })
    .where(eq(visaApplications.id, applicationId));
}
