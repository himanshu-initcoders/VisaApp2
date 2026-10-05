/**
 * Submit one visa application.
 * Paid listings are accepted only after a captured Razorpay payment.
 * A zero-fee listing submits without a charge.
 */

'use server';

import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { db } from '@/lib/db';
import {
  applicationDrafts,
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
  uploadApplicationDocuments,
  type ApplicationDocumentUploadItem,
} from '@/lib/upload/application-actions';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  validateSubmitTravellers,
  type SubmitTravellerPayload,
} from '@/lib/apply/validateSubmitTravellers';
import { quoteVisaListing } from '@/lib/payments/quote';
import { attachPaymentsToApplication } from '@/lib/payments/record';

export type { SubmitTravellerPayload } from '@/lib/apply/validateSubmitTravellers';

export interface SubmitApplicationInput {
  submitId: string;
  listingId: string;
  countryCode: string;
  travellers: SubmitTravellerPayload[];
  /** IndexDB files encoded as base64 (no data: prefix). */
  files: ApplicationDocumentUploadItem[];
  priceOptionId?: string | null;
  /** Captured payments.id. Required when the listing fee is above zero. */
  paymentId?: string | null;
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
    if (!input.listingId || !input.countryCode) {
      return { success: false, error: 'Missing listing or country.' };
    }

    const [existing] = await db
      .select({
        id: visaApplications.id,
        userId: visaApplications.userId,
      })
      .from(visaApplications)
      .where(eq(visaApplications.submitId, input.submitId))
      .limit(1);

    if (existing) {
      if (existing.userId !== userId) {
        return {
          success: false,
          error: 'This submission belongs to another account.',
        };
      }
      await attachPaymentsToApplication({
        applicationId: existing.id,
        submitId: input.submitId,
        paymentId: input.paymentId,
      });
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
        email: users.email,
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
        paymentId: resolvedPaymentId,
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
        await attachPaymentsToApplication({
          applicationId: raced.id,
          submitId: input.submitId,
          paymentId: resolvedPaymentId,
        });
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

    const insertedTravellers = await db
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
      await db.insert(statusHistory).values(
        insertedTravellers.map((traveller) => ({
          applicationId,
          applicationType: 'visa' as const,
          travellerId: traveller.id,
          oldStatus: null,
          newStatus: 'submitted',
          changedBy: userId,
          notes: resolvedPaymentId
            ? 'Submitted after Razorpay payment'
            : 'Submitted with no fee',
          createdAt: now,
        }))
      );
    }

    await attachPaymentsToApplication({
      applicationId,
      submitId: input.submitId,
      paymentId: resolvedPaymentId,
    });

    await db
      .delete(applicationDrafts)
      .where(
        and(
          eq(applicationDrafts.userId, userId),
          eq(applicationDrafts.listingId, input.listingId)
        )
      );

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
      applicationId,
    });
    await notifyVisaSubmittedToAdmin({
      applicantName: primaryName,
      phone: userRow.phone,
      country: countryName,
      visaType: visaTypeLabel,
      applicationId,
    });

    return { success: true, applicationId };
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
