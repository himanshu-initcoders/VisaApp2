/**
 * Submit a visa application by flipping an existing draft row to submitted.
 * Files already live under the application storage path — no promote/copy.
 */

'use server';

import { and, eq, inArray } from 'drizzle-orm';
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
import { resolveFormTravellerId } from '@/lib/apply/formTravellerId';
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
import {
  ensureTravelerProfile,
  IncompleteTravelerIdentityError,
} from '@/lib/dashboard/travelerProfileStore';
import { upsertProfileDocument } from '@/lib/upload/profileDocumentVault';
import { uploadService } from '@/lib/upload';

export type { SubmitTravellerPayload } from '@/lib/apply/validateSubmitTravellers';

export interface DraftStorageKeySubmitItem {
  travellerId?: string;
  /** @deprecated Use travellerId */
  passengerId?: string;
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

function buildTravellerNames(travellers: SubmitTravellerPayload[]): string {
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
  documentId?: string;
};

function resolveDocumentKeys(
  draftStorageKeys: DraftStorageKeySubmitItem[]
): UploadResultRow[] {
  const results: UploadResultRow[] = [];
  const covered = new Set<string>();

  for (const item of draftStorageKeys) {
    const travellerId = item.travellerId || item.passengerId || '';
    if (!travellerId) continue;
    const dedupe = `${travellerId}:${item.slotKey}`;
    if (covered.has(dedupe)) continue;
    covered.add(dedupe);
    results.push({
      passengerId: travellerId,
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

/**
 * Submit document source of truth: client draft refs only.
 * Prefer draftStorageKeys; fill gaps from the same-request travellers payload.
 * No DB draft JSON merge and no s3_key LIKE path hunt.
 */
async function collectSubmitUploadRows(input: {
  travellers: SubmitTravellerPayload[];
  draftStorageKeys: DraftStorageKeySubmitItem[];
}): Promise<UploadResultRow[]> {
  const bySlot = new Map<string, UploadResultRow>();

  const remember = (row: UploadResultRow) => {
    if (!row.passengerId || !row.slotKey || !row.key) return;
    const dedupe = `${row.passengerId}:${row.slotKey}`;
    if (!bySlot.has(dedupe)) bySlot.set(dedupe, row);
  };

  for (const row of resolveDocumentKeys(input.draftStorageKeys)) {
    remember(row);
  }

  for (const traveller of input.travellers) {
    const passengerId = resolveFormTravellerId({
      id: traveller.id,
      passengerId: (traveller as { passengerId?: string }).passengerId,
    });
    if (!passengerId) continue;

    const draftFileRefs = Array.isArray(traveller.draftFileRefs)
      ? traveller.draftFileRefs
      : [];
    for (const ref of draftFileRefs) {
      if (!ref || typeof ref !== 'object') continue;
      const r = ref as Record<string, unknown>;
      const slotKey = typeof r.slotKey === 'string' ? r.slotKey : '';
      const key = typeof r.storageKey === 'string' ? r.storageKey : '';
      if (!slotKey || !key) continue;
      remember({
        passengerId,
        slotKey,
        key,
        url: typeof r.url === 'string' ? r.url : '',
        mimeType:
          typeof r.mimeType === 'string'
            ? r.mimeType
            : 'application/octet-stream',
        filename:
          typeof r.filename === 'string' ? r.filename : `${slotKey}.bin`,
        size: typeof r.size === 'number' ? r.size : 0,
      });
    }

    const docs = Array.isArray(traveller.documents) ? traveller.documents : [];
    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue;
      const d = doc as Record<string, unknown>;
      const slotKey =
        (typeof d.key === 'string' && d.key) ||
        (typeof d.slotKey === 'string' && d.slotKey) ||
        '';
      const storageKey =
        typeof d.storageKey === 'string' && d.storageKey.includes('/')
          ? d.storageKey
          : typeof d.key === 'string' && d.key.includes('/')
            ? d.key
            : '';
      if (!slotKey || !storageKey) continue;
      remember({
        passengerId,
        slotKey,
        key: storageKey,
        url: typeof d.storageUrl === 'string' ? d.storageUrl : '',
        mimeType:
          typeof d.mimeType === 'string'
            ? d.mimeType
            : 'application/octet-stream',
        filename:
          typeof d.name === 'string'
            ? d.name
            : typeof d.filename === 'string'
              ? d.filename
              : `${slotKey}.bin`,
        size: typeof d.size === 'number' ? d.size : 0,
      });
    }
  }

  const rows = Array.from(bySlot.values());
  const keys = [...new Set(rows.map((r) => r.key).filter(Boolean))];
  if (keys.length === 0) return rows;

  const existing = await db
    .select({ id: documents.id, s3Key: documents.s3Key })
    .from(documents)
    .where(inArray(documents.s3Key, keys));
  const idByKey = new Map(existing.map((r) => [r.s3Key, r.id]));

  return rows.map((row) => ({
    ...row,
    documentId: row.documentId || idByKey.get(row.key),
  }));
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

    const uploadResults = (
      await collectSubmitUploadRows({
        travellers: input.travellers,
        draftStorageKeys: input.draftStorageKeys ?? [],
      })
    ).map((row) => ({
      ...row,
      url: row.url || uploadService.getUrl(row.key),
    }));

    const primaryName =
      input.travellers[0]?.name?.trim() || userRow.name || 'Applicant';
    const travellerNames = buildTravellerNames(input.travellers);
    const resolvedVisaType =
      listing.processTypeLabel ||
      listing.processType ||
      listing.purpose ||
      listing.processName;

    const now = new Date();
    const applicationId = draftApp.id;
    const referenceNumber = draftApp.referenceNumber;

    let travellersJson: Array<{
      passengerId: string;
      name: string;
      passportData: Record<string, unknown> | null;
      tripDetails: unknown;
      documents: Array<{
        documentId?: string;
        slotKey: string;
        key: string;
        url: string;
        mimeType: string;
        filename: string;
        size: number;
      }>;
      passportUploaded: boolean;
      photoUploaded: boolean;
      applicationComplete: boolean;
    }> = [];

    await db.transaction(async (tx) => {
      const uploadsByPassenger = new Map<string, UploadResultRow[]>();
      const passengerProfileIds = new Map<string, string>();

      for (const traveller of input.travellers) {
        try {
          const profile = await ensureTravelerProfile(tx, userId, {
            passengerId: traveller.id,
            name: traveller.name.trim(),
            passportData: traveller.passportData ?? null,
          });
          passengerProfileIds.set(traveller.id, profile.id);
        } catch (error) {
          if (error instanceof IncompleteTravelerIdentityError) {
            throw new Error(
              `Traveller "${traveller.name.trim() || traveller.id}" needs name, date of birth, and passport number before submit`
            );
          }
          throw error;
        }
      }

      const enrichedUploads: UploadResultRow[] = [];
      for (const result of uploadResults) {
        const profileId = passengerProfileIds.get(result.passengerId);
        if (!profileId) {
          enrichedUploads.push(result);
          continue;
        }
        const vault = await upsertProfileDocument(tx, {
          userId,
          profileId,
          slotKey: result.slotKey,
          key: result.key,
          filename: result.filename,
          size: result.size,
          mimeType: result.mimeType,
          mode: 'submit',
          now,
        });
        const enriched = {
          ...result,
          documentId: vault.document.id,
          url: result.url || uploadService.getUrl(result.key),
        };
        enrichedUploads.push(enriched);
        const list = uploadsByPassenger.get(result.passengerId) ?? [];
        list.push(enriched);
        uploadsByPassenger.set(result.passengerId, list);
      }

      travellersJson = input.travellers.map((traveller) => {
        const uploaded = uploadsByPassenger.get(traveller.id) ?? [];
        return {
          passengerId: traveller.id,
          name: traveller.name.trim(),
          passportData: traveller.passportData ?? null,
          tripDetails: traveller.tripDetails ?? null,
          documents: uploaded.map((u) => ({
            documentId: u.documentId,
            slotKey: u.slotKey,
            key: u.key,
            url: u.url,
            mimeType: u.mimeType,
            filename: u.filename,
            size: u.size,
          })),
          passportUploaded: Boolean(traveller.passportUploaded),
          photoUploaded: Boolean(traveller.photoUploaded),
          applicationComplete: Boolean(traveller.applicationComplete),
        };
      });

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
          travellerNames,
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
          documents: enrichedUploads.map((r) => ({
            documentId: r.documentId,
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
              formTravellerId: traveller.passengerId.slice(0, 100),
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
