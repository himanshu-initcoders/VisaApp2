/**
 * Phase 3: mock-pay submit — create one submitted visa application.
 */

'use server';

import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  applicationDrafts,
  documents,
  statusHistory,
  users,
  visaApplications,
} from '@/lib/db/schema';
import { visaListings, countries } from '@/lib/db/schema-extended';
import { ensureFormVersionForSubmit } from '@/lib/db/queries/formVersions';
import {
  uploadApplicationDocuments,
  type ApplicationDocumentUploadItem,
} from '@/lib/upload/application-actions';
import {
  emptyTripDetails,
  getCoreTripIssues,
  getMultiStopIssues,
  type ApplyFormConfig,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';

export interface SubmitTravellerPayload {
  id: string;
  name: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Record<string, unknown> | null;
  documents?: Array<{
    key: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }>;
  passportUploaded?: boolean;
  photoUploaded?: boolean;
  applicationComplete?: boolean;
}

export interface SubmitApplicationInput {
  submitId: string;
  listingId: string;
  countryCode: string;
  travellers: SubmitTravellerPayload[];
  /** IndexDB files encoded as base64 (no data: prefix). */
  files: ApplicationDocumentUploadItem[];
}

export type SubmitApplicationResult =
  | {
      success: true;
      applicationId: string;
      alreadySubmitted?: boolean;
    }
  | { success: false; error: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function buildPassengerNames(travellers: SubmitTravellerPayload[]): string {
  return travellers
    .map((t) => (t.name || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function validateTravellers(
  travellers: SubmitTravellerPayload[],
  snapshot: ApplyFormConfig
): string | null {
  if (!travellers.length) {
    return 'Add at least one traveller before submitting.';
  }

  for (const traveller of travellers) {
    if (!traveller.name?.trim()) {
      return 'Each traveller needs a name.';
    }
    if (!traveller.passportData) {
      return `Complete passport details for ${traveller.name || 'each traveller'}.`;
    }

    if (snapshot.showTripDetails !== false) {
      const trip = emptyTripDetails(
        (traveller.tripDetails ?? undefined) as
          | Partial<TravellerTripDetails>
          | undefined
      );
      const issue = [
        ...getCoreTripIssues(trip),
        ...getMultiStopIssues(trip),
      ][0];
      if (issue) {
        const who = traveller.name?.trim() || 'Traveller';
        return `${who}: ${issue}`;
      }
    }
  }

  return null;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: 'You must be signed in to submit.' };
    }

    if (!input.submitId || !isUuid(input.submitId)) {
      return { success: false, error: 'Invalid submit id.' };
    }
    if (!input.listingId || !input.countryCode) {
      return { success: false, error: 'Missing listing or country.' };
    }

    const [existing] = await db
      .select({ id: visaApplications.id })
      .from(visaApplications)
      .where(eq(visaApplications.submitId, input.submitId))
      .limit(1);

    if (existing) {
      return {
        success: true,
        applicationId: existing.id,
        alreadySubmitted: true,
      };
    }

    const formVersion = await ensureFormVersionForSubmit(
      input.listingId,
      userId
    );
    if (!formVersion) {
      return {
        success: false,
        error:
          'Listing form not published. Ask an admin to open Form Builder and click Publish form version.',
      };
    }

    const snapshot = formVersion.config as ApplyFormConfig;
    const validationError = validateTravellers(input.travellers, snapshot);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const [listing] = await db
      .select({
        id: visaListings.id,
        processName: visaListings.processName,
        processType: visaListings.processType,
        processTypeLabel: visaListings.processTypeLabel,
        purpose: visaListings.purpose,
        destinationCountry: visaListings.destinationCountry,
      })
      .from(visaListings)
      .where(eq(visaListings.id, input.listingId))
      .limit(1);

    if (!listing) {
      return { success: false, error: 'Visa listing not found.' };
    }

    const countryCode = (
      input.countryCode || listing.destinationCountry
    ).toUpperCase();

    const [country] = await db
      .select({ name: countries.name, iso2Code: countries.iso2Code })
      .from(countries)
      .where(eq(countries.iso2Code, countryCode))
      .limit(1);

    const [userRow] = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) {
      return { success: false, error: 'User not found.' };
    }

    const applicationId = randomUUID();

    const uploadResult = await uploadApplicationDocuments({
      countryCode,
      listingId: input.listingId,
      applicationId,
      documents: input.files ?? [],
    });

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Document upload failed.',
      };
    }

    const uploadsByPassenger = new Map<
      string,
      Array<{
        slotKey: string;
        key: string;
        url: string;
        mimeType: string;
        filename: string;
        size: number;
      }>
    >();

    for (const result of uploadResult.results) {
      const list = uploadsByPassenger.get(result.passengerId) ?? [];
      list.push({
        slotKey: result.slotKey,
        key: result.key,
        url: result.url,
        mimeType: result.mimeType,
        filename: result.filename,
        size: result.size,
      });
      uploadsByPassenger.set(result.passengerId, list);
    }

    const travellersJson = input.travellers.map((traveller) => {
      const uploaded = uploadsByPassenger.get(traveller.id) ?? [];
      return {
        passengerId: traveller.id,
        name: traveller.name.trim(),
        passportData: traveller.passportData ?? null,
        tripDetails: traveller.tripDetails ?? null,
        documents: uploaded.map((u) => ({
          slotKey: u.slotKey,
          key: u.key,
          url: u.url,
          mimeType: u.mimeType,
          filename: u.filename,
          size: u.size,
        })),
        passportUploaded: traveller.passportUploaded,
        photoUploaded: traveller.photoUploaded,
        applicationComplete: traveller.applicationComplete,
      };
    });

    const primaryName =
      travellersJson[0]?.name || userRow.name || 'Applicant';
    const passengerNames = buildPassengerNames(input.travellers);
    const resolvedVisaType =
      listing.processTypeLabel ||
      listing.processType ||
      listing.purpose ||
      listing.processName;

    const now = new Date();

    try {
      await db.insert(visaApplications).values({
        id: applicationId,
        userId,
        countryCode,
        visaListingId: input.listingId,
        country: country?.name ?? countryCode,
        visaType: String(resolvedVisaType).slice(0, 100),
        status: 'submitted',
        formVersionId: formVersion.id,
        formSnapshot: formVersion.config,
        travellers: travellersJson,
        applicantName: primaryName.slice(0, 255),
        applicantPhone: userRow.phone,
        passengerNames,
        submitId: input.submitId,
        submittedAt: now,
        updatedAt: now,
        personalInfo: {
          travellers: travellersJson,
          primaryName,
        },
        travelInfo: travellersJson[0]?.tripDetails ?? null,
        documents: uploadResult.results.map((r) => ({
          key: r.key,
          url: r.url,
          slotKey: r.slotKey,
          passengerId: r.passengerId,
        })),
      });
    } catch (insertError) {
      const [raced] = await db
        .select({ id: visaApplications.id })
        .from(visaApplications)
        .where(eq(visaApplications.submitId, input.submitId))
        .limit(1);
      if (raced) {
        return {
          success: true,
          applicationId: raced.id,
          alreadySubmitted: true,
        };
      }
      throw insertError;
    }

    if (uploadResult.results.length > 0) {
      await db.insert(documents).values(
        uploadResult.results.map((r) => ({
          applicationId,
          applicationType: 'visa',
          documentType: r.slotKey,
          s3Key: r.key,
          filename: r.filename,
          fileSize: r.size,
          mimeType: r.mimeType,
          verified: null,
          uploadedAt: now,
        }))
      );
    }

    await db.insert(statusHistory).values({
      applicationId,
      applicationType: 'visa',
      oldStatus: null,
      newStatus: 'submitted',
      changedBy: userId,
      notes: 'Submitted via mock pay',
      createdAt: now,
    });

    await db
      .delete(applicationDrafts)
      .where(
        and(
          eq(applicationDrafts.userId, userId),
          eq(applicationDrafts.listingId, input.listingId)
        )
      );

    return { success: true, applicationId };
  } catch (error) {
    console.error('submitApplication error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to submit application',
    };
  }
}
