/**
 * Submit a visa application by flipping an existing draft row to submitted.
 * Files already live under the application storage path — no promote/copy.
 */

'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import {
  documents,
  payments,
  statusHistory,
  users,
  visaApplicationTravellers,
  visaApplications,
} from '@/lib/db/schema';
import { visaListings, countries } from '@/lib/db/schema-extended';
import { ensureFormVersionForSubmit } from '@/lib/db/queries/formVersions';
import {
  notifyVisaSubmittedToAdmin,
  notifyVisaSubmittedToApplicant,
} from '@/lib/email/notify';
import {
  notifyVisaSubmittedToAdminWhatsApp,
  notifyVisaSubmittedToApplicantWhatsApp,
} from '@/lib/whatsapp/notify';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  validateSubmitTravellers,
  type SubmitTravellerPayload,
} from '@/lib/apply/validateSubmitTravellers';
import { quoteVisaListing } from '@/lib/payments/quote';
import { attachPaymentsToApplication } from '@/lib/payments/record';

export type { SubmitTravellerPayload } from '@/lib/apply/validateSubmitTravellers';

export interface DraftStorageKeySubmitItem {
  passengerId: string;
  slotKey: string;
  storageKey: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

export interface SubmitApplicationInput {
  submitId: string;
  listingId: string;
  countryCode: string;
  /** Existing draft application id (required). */
  applicationId: string;
  travellers: SubmitTravellerPayload[];
  /** Storage keys already under the application path. */
  draftStorageKeys?: DraftStorageKeySubmitItem[];
  priceOptionId?: string | null;
  paymentId?: string | null;
  interestedInInsurance?: boolean;
}

export type SubmitApplicationResult =
  | {
      success: true;
      applicationId: string;
      referenceNumber: string;
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

async function requireCapturedPayment(input: {
  userId: string;
  submitId: string;
  paymentId: string | null | undefined;
  amountPaise: number;
  travellerCount: number;
  priceOptionId: string | null;
}): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  if (!input.paymentId || !isUuid(input.paymentId)) {
    return { ok: false, error: 'Payment is required before submitting.' };
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, input.paymentId))
    .limit(1);

  if (
    !payment ||
    payment.userId !== input.userId ||
    payment.submitId !== input.submitId
  ) {
    return { ok: false, error: 'Payment not found for this submission.' };
  }
  if (payment.status !== 'completed') {
    return { ok: false, error: 'Payment is not complete.' };
  }
  if (payment.applicationType !== 'visa' || payment.currency !== 'INR') {
    return { ok: false, error: 'Payment is not valid for this application.' };
  }
  if (payment.amount !== input.amountPaise) {
    return {
      ok: false,
      error: 'Payment amount does not match the current fee.',
    };
  }
  if (payment.travellerCount !== input.travellerCount) {
    return {
      ok: false,
      error: 'Payment does not match the number of travellers.',
    };
  }
  if (
    input.priceOptionId &&
    payment.priceOptionId &&
    payment.priceOptionId !== input.priceOptionId
  ) {
    return {
      ok: false,
      error: 'Payment does not match the selected visa option.',
    };
  }

  return { ok: true, paymentId: payment.id };
}

type UploadResultRow = {
  passengerId: string;
  slotKey: string;
  key: string;
  url: string;
  mimeType: string;
  filename: string;
  size: number;
};

function resolveDocumentKeys(
  draftStorageKeys: DraftStorageKeySubmitItem[]
): UploadResultRow[] {
  const results: UploadResultRow[] = [];
  const covered = new Set<string>();

  for (const item of draftStorageKeys) {
    const dedupe = `${item.passengerId}:${item.slotKey}`;
    if (covered.has(dedupe)) continue;
    covered.add(dedupe);
    results.push({
      passengerId: item.passengerId,
      slotKey: item.slotKey,
      key: item.storageKey,
      url: '',
      mimeType: item.mimeType || 'application/octet-stream',
      filename: item.filename || `${item.slotKey}.bin`,
      size: item.size ?? 0,
    });
  }

  return results;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'You must be signed in to submit.' };
    }

    const userId = await resolveSessionUserId(session.user);
    if (!userId) {
      return {
        success: false,
        error: 'Your session is out of date. Sign out and sign in again.',
      };
    }

    if (!input.submitId || !isUuid(input.submitId)) {
      return { success: false, error: 'Invalid submit id.' };
    }
    if (!input.applicationId || !isUuid(input.applicationId)) {
      return { success: false, error: 'Missing draft application id.' };
    }
    if (!input.listingId || !input.countryCode) {
      return { success: false, error: 'Missing listing or country.' };
    }

    const [draftApp] = await db
      .select()
      .from(visaApplications)
      .where(eq(visaApplications.id, input.applicationId))
      .limit(1);

    if (!draftApp || draftApp.userId !== userId) {
      return { success: false, error: 'Draft application not found.' };
    }

    if (draftApp.visaListingId !== input.listingId) {
      return { success: false, error: 'Application listing mismatch.' };
    }

    if (draftApp.status !== 'draft') {
      await attachPaymentsToApplication({
        applicationId: draftApp.id,
        submitId: input.submitId,
        paymentId: input.paymentId,
      });
      return {
        success: true,
        applicationId: draftApp.id,
        referenceNumber: draftApp.referenceNumber,
        alreadySubmitted: true,
      };
    }

    // Idempotency: another submit already claimed this submitId on a different row.
    const [bySubmitId] = await db
      .select({
        id: visaApplications.id,
        userId: visaApplications.userId,
        referenceNumber: visaApplications.referenceNumber,
        status: visaApplications.status,
      })
      .from(visaApplications)
      .where(eq(visaApplications.submitId, input.submitId))
      .limit(1);

    if (bySubmitId && bySubmitId.id !== draftApp.id) {
      if (bySubmitId.userId !== userId) {
        return {
          success: false,
          error: 'This submission belongs to another account.',
        };
      }
      return {
        success: true,
        applicationId: bySubmitId.id,
        referenceNumber: bySubmitId.referenceNumber,
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
    const validationError = validateSubmitTravellers(input.travellers, snapshot);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const quoted = await quoteVisaListing({
      listingId: input.listingId,
      priceOptionId: input.priceOptionId,
      travellerCount: input.travellers.length,
    });
    if (!quoted.ok) {
      return { success: false, error: quoted.error };
    }

    let resolvedPaymentId: string | null = null;
    if (quoted.quote.amountPaise > 0) {
      const paid = await requireCapturedPayment({
        userId,
        submitId: input.submitId,
        paymentId: input.paymentId,
        amountPaise: quoted.quote.amountPaise,
        travellerCount: quoted.quote.travellerCount,
        priceOptionId: quoted.quote.priceOptionId,
      });
      if (!paid.ok) return { success: false, error: paid.error };
      resolvedPaymentId = paid.paymentId;
    }

    const [listing] = await db
      .select({
        id: visaListings.id,
        processName: visaListings.processName,
        processType: visaListings.processType,
        processTypeLabel: visaListings.processTypeLabel,
        purpose: visaListings.purpose,
        destinationCountry: visaListings.destinationCountry,
        withFreeInsurance: visaListings.withFreeInsurance,
        showInsuranceInterest: visaListings.showInsuranceInterest,
      })
      .from(visaListings)
      .where(eq(visaListings.id, input.listingId))
      .limit(1);

    if (!listing) {
      return { success: false, error: 'Visa listing not found.' };
    }

    const interestedInInsurance =
      !listing.withFreeInsurance &&
      listing.showInsuranceInterest &&
      input.interestedInInsurance === true;

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
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) {
      return { success: false, error: 'User not found.' };
    }

    const uploadResults = resolveDocumentKeys(input.draftStorageKeys ?? []);
    const uploadsByPassenger = new Map<string, UploadResultRow[]>();
    for (const result of uploadResults) {
      const list = uploadsByPassenger.get(result.passengerId) ?? [];
      list.push(result);
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
    const applicationId = draftApp.id;
    const referenceNumber = draftApp.referenceNumber;

    await db.transaction(async (tx) => {
      await tx
        .update(visaApplications)
        .set({
          countryCode,
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
          paymentId: resolvedPaymentId,
          interestedInInsurance,
          submittedAt: now,
          updatedAt: now,
          personalInfo: {
            travellers: travellersJson,
            primaryName,
            interestedInInsurance,
          },
          travelInfo: travellersJson[0]?.tripDetails ?? null,
          documents: uploadResults.map((r) => ({
            key: r.key,
            url: r.url,
            slotKey: r.slotKey,
            passengerId: r.passengerId,
          })),
        })
        .where(
          and(
            eq(visaApplications.id, applicationId),
            eq(visaApplications.status, 'draft')
          )
        );

      for (const result of uploadResults) {
        const existingDocs = await tx
          .select({ id: documents.id, s3Key: documents.s3Key })
          .from(documents)
          .where(
            and(
              eq(documents.applicationId, applicationId),
              eq(documents.applicationType, 'visa'),
              eq(documents.documentType, result.slotKey)
            )
          );

        const match =
          existingDocs.find((row) => row.s3Key === result.key) ||
          existingDocs.find((row) =>
            row.s3Key.includes(`/passengers/${result.passengerId}/`)
          ) ||
          (existingDocs.length === 1 ? existingDocs[0] : undefined);

        if (match) {
          await tx
            .update(documents)
            .set({
              s3Key: result.key,
              filename: result.filename,
              fileSize: result.size,
              mimeType: result.mimeType,
              verified: null,
              uploadedAt: now,
            })
            .where(eq(documents.id, match.id));
        } else {
          await tx.insert(documents).values({
            applicationId,
            applicationType: 'visa',
            documentType: result.slotKey,
            s3Key: result.key,
            filename: result.filename,
            fileSize: result.size,
            mimeType: result.mimeType,
            verified: null,
            uploadedAt: now,
          });
        }
      }

      const existingTravellers = await tx
        .select({ id: visaApplicationTravellers.id })
        .from(visaApplicationTravellers)
        .where(eq(visaApplicationTravellers.applicationId, applicationId));

      if (existingTravellers.length === 0) {
        const insertedTravellers = await tx
          .insert(visaApplicationTravellers)
          .values(
            travellersJson.map((traveller) => ({
              applicationId,
              passengerId: traveller.passengerId.slice(0, 100),
              name: (traveller.name || 'Traveller').slice(0, 255),
              status: 'submitted',
              updatedAt: now,
            }))
          )
          .returning({
            id: visaApplicationTravellers.id,
          });

        if (insertedTravellers.length > 0) {
          await tx.insert(statusHistory).values(
            insertedTravellers.map((traveller) => ({
              applicationId,
              applicationType: 'visa' as const,
              travellerId: traveller.id,
              oldStatus: 'draft',
              newStatus: 'submitted',
              changedBy: userId,
              notes: resolvedPaymentId
                ? 'Submitted after Razorpay payment'
                : 'Submitted with no fee',
              createdAt: now,
            }))
          );
        }
      }
    });

    await attachPaymentsToApplication({
      applicationId,
      submitId: input.submitId,
      paymentId: resolvedPaymentId,
    });

    const passportData = travellersJson[0]?.passportData;
    const passportEmail =
      passportData &&
      typeof passportData === 'object' &&
      typeof (passportData as { email?: unknown }).email === 'string'
        ? (passportData as { email: string }).email
        : null;

    const countryName = country?.name ?? countryCode;
    const visaTypeLabel = String(resolvedVisaType);

    await notifyVisaSubmittedToApplicant({
      accountEmail: userRow.email,
      passportEmail,
      applicantName: primaryName,
      country: countryName,
      visaType: visaTypeLabel,
      referenceNumber,
    });
    await notifyVisaSubmittedToApplicantWhatsApp({
      userId: userRow.id,
      applicantName: primaryName,
      phone: userRow.phone,
      country: countryName,
      visaType: visaTypeLabel,
      referenceNumber,
    });
    await notifyVisaSubmittedToAdmin({
      applicantName: primaryName,
      phone: userRow.phone,
      country: countryName,
      visaType: visaTypeLabel,
      referenceNumber,
    });
    await notifyVisaSubmittedToAdminWhatsApp({
      applicantName: primaryName,
      phone: userRow.phone,
      country: countryName,
      visaType: visaTypeLabel,
      referenceNumber,
    });

    return { success: true, applicationId, referenceNumber };
  } catch (error) {
    console.error('submitApplication error:', error);
    const message = error instanceof Error ? error.message : '';
    return {
      success: false,
      error: message.startsWith('Failed query')
        ? 'Failed to submit application'
        : message || 'Failed to submit application',
    };
  }
}
