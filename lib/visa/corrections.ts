import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  applicationComments,
  correctionItems,
  correctionRequests,
  notifications,
  users,
  visaApplicationTravellers,
  visaApplications,
} from '@/lib/db/schema';
import {
  type ApplyFormConfig,
  type ApplyTripQuestion,
} from '@/lib/apply/applicationForm';
import { PASSPORT_REVIEW_GROUPS } from '@/lib/apply/reviewFields';
import { reviewerOwnsVisa } from '@/lib/reviewer-access';
import { indianPassportFieldsSchema } from '@/lib/passport/schema';
import { earliestFutureDateIso, isIsoDate } from '@/lib/passport/schema';

const PASSPORT_FRONT_SLOT = 'passport-front';
const PASSPORT_BACK_SLOT = 'passport-back';

const TRIP_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'arrivalDate', label: 'Intended arrival date' },
  { key: 'returnDate', label: 'Intended return date' },
  { key: 'flightNumber', label: 'Arrival flight number' },
  { key: 'arrivalFlightDate', label: 'Arrival flight date' },
  { key: 'returnFlightNumber', label: 'Return flight number' },
  { key: 'returnFlightDate', label: 'Return flight date' },
  { key: 'arrivalCity', label: 'Arrival city' },
  { key: 'accommodationName', label: 'Hotel / accommodation name' },
  { key: 'accommodationAddress', label: 'Stay address' },
];

const FUTURE_TRIP_FIELDS = new Set([
  'arrivalDate',
  'returnDate',
  'arrivalFlightDate',
  'returnFlightDate',
]);

export interface CorrectableTarget {
  kind: 'document' | 'field';
  targetKey: string;
  label: string;
  group: string;
}

export const correctionItemInputSchema = z.object({
  kind: z.enum(['document', 'field']),
  targetKey: z.string().trim().min(1).max(200),
  comment: z.string().trim().min(1).max(2000),
});

export const requestCorrectionSchema = z.object({
  applicationId: z.string().uuid(),
  travellerId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  items: z.array(correctionItemInputSchema).min(1).max(40),
});

export const commentBodySchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

export const resolveCorrectionSchema = z.object({
  requestId: z.string().uuid(),
});

export const submitCorrectionSchema = z.object({
  applicationId: z.string().uuid(),
  travellerId: z.string().uuid(),
  fields: z.record(z.string(), z.string()).default({}),
  files: z
    .array(
      z.object({
        slotKey: z.string().trim().min(1).max(200),
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(100),
        bufferBase64: z.string().min(1),
      })
    )
    .max(20)
    .default([]),
});

export type RequestCorrectionInput = z.infer<typeof requestCorrectionSchema>;
export type SubmitCorrectionInput = z.infer<typeof submitCorrectionSchema>;

export interface StoredTravellerDoc {
  slotKey?: string;
  key?: string;
  url?: string;
  mimeType?: string;
  filename?: string;
  size?: number;
}

export interface StoredTraveller {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Record<string, unknown> | null;
  documents?: StoredTravellerDoc[];
  passportUploaded?: boolean;
  photoUploaded?: boolean;
  applicationComplete?: boolean;
}

export function buildCorrectableTargets(
  config: ApplyFormConfig | null
): CorrectableTarget[] {
  const targets: CorrectableTarget[] = [];
  const showGeneral = config?.showGeneralInfo !== false;
  const showTrip = config?.showTripDetails !== false;

  if (showGeneral) {
    for (const group of PASSPORT_REVIEW_GROUPS) {
      for (const field of group.fields) {
        targets.push({
          kind: 'field',
          targetKey: `passport.${field.key}`,
          label: field.label,
          group: group.title,
        });
      }
    }
    targets.push(
      {
        kind: 'document',
        targetKey: PASSPORT_FRONT_SLOT,
        label: 'Passport front',
        group: 'Passport images',
      },
      {
        kind: 'document',
        targetKey: PASSPORT_BACK_SLOT,
        label: 'Passport back',
        group: 'Passport images',
      }
    );
  }

  if (showTrip) {
    for (const field of TRIP_FIELDS) {
      targets.push({
        kind: 'field',
        targetKey: `trip.${field.key}`,
        label: field.label,
        group: 'Trip details',
      });
    }
  }

  for (const question of config?.extraQuestions ?? []) {
    targets.push({
      kind: 'field',
      targetKey: `extra.${question.key}`,
      label: question.label,
      group: 'Additional questions',
    });
  }

  for (const slot of config?.documentSlots ?? []) {
    targets.push({
      kind: 'document',
      targetKey: slot.key,
      label: slot.title,
      group: 'Documents',
    });
  }

  return targets;
}

export function labelForTarget(
  config: ApplyFormConfig | null,
  targetKey: string
): string {
  return (
    buildCorrectableTargets(config).find((item) => item.targetKey === targetKey)
      ?.label ?? targetKey
  );
}

export function validateRequestedItems(
  config: ApplyFormConfig | null,
  items: Array<{ kind: 'document' | 'field'; targetKey: string }>
): string | null {
  const allowed = new Map(
    buildCorrectableTargets(config).map((item) => [item.targetKey, item.kind])
  );
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.targetKey)) {
      return 'Each field or document can only be requested once.';
    }
    seen.add(item.targetKey);
    const kind = allowed.get(item.targetKey);
    if (!kind) return `Unknown item: ${item.targetKey}`;
    if (kind !== item.kind) return `Wrong kind for ${item.targetKey}`;
  }
  return null;
}

export function readTargetValue(
  traveller: StoredTraveller,
  targetKey: string
): unknown {
  if (targetKey.startsWith('passport.')) {
    const field = targetKey.slice('passport.'.length);
    return traveller.passportData?.[field] ?? '';
  }
  if (targetKey.startsWith('trip.')) {
    const field = targetKey.slice('trip.'.length);
    return traveller.tripDetails?.[field] ?? '';
  }
  if (targetKey.startsWith('extra.')) {
    const field = targetKey.slice('extra.'.length);
    const extra = traveller.tripDetails?.extra;
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      return (extra as Record<string, unknown>)[field] ?? '';
    }
    return '';
  }
  const doc = (traveller.documents ?? []).find(
    (item) => item.slotKey === targetKey
  );
  if (!doc) return null;
  return {
    filename: doc.filename ?? null,
    key: doc.key ?? null,
    url: doc.url ?? null,
  };
}

export function writeFieldValue(
  traveller: StoredTraveller,
  targetKey: string,
  value: string
): StoredTraveller {
  const next: StoredTraveller = {
    ...traveller,
    passportData: { ...(traveller.passportData ?? {}) },
    tripDetails: { ...(traveller.tripDetails ?? {}) },
    documents: [...(traveller.documents ?? [])],
  };

  if (targetKey.startsWith('passport.')) {
    next.passportData![targetKey.slice('passport.'.length)] = value;
    return next;
  }
  if (targetKey.startsWith('trip.')) {
    const field = targetKey.slice('trip.'.length);
    const trip = { ...(next.tripDetails ?? {}) };
    trip[field] = value;
    const arrivalFlights = Array.isArray(trip.arrivalFlights)
      ? [...(trip.arrivalFlights as Array<Record<string, unknown>>)]
      : [];
    const returnFlights = Array.isArray(trip.returnFlights)
      ? [...(trip.returnFlights as Array<Record<string, unknown>>)]
      : [];
    if (field === 'flightNumber' && arrivalFlights[0]) {
      arrivalFlights[0] = { ...arrivalFlights[0], flightNumber: value };
      trip.arrivalFlights = arrivalFlights;
    }
    if (field === 'arrivalFlightDate' && arrivalFlights[0]) {
      arrivalFlights[0] = { ...arrivalFlights[0], date: value };
      trip.arrivalFlights = arrivalFlights;
    }
    if (field === 'returnFlightNumber' && returnFlights[0]) {
      returnFlights[0] = { ...returnFlights[0], flightNumber: value };
      trip.returnFlights = returnFlights;
    }
    if (field === 'returnFlightDate' && returnFlights[0]) {
      returnFlights[0] = { ...returnFlights[0], date: value };
      trip.returnFlights = returnFlights;
    }
    next.tripDetails = trip;
    return next;
  }
  if (targetKey.startsWith('extra.')) {
    const extra =
      next.tripDetails?.extra &&
      typeof next.tripDetails.extra === 'object' &&
      !Array.isArray(next.tripDetails.extra)
        ? { ...(next.tripDetails.extra as Record<string, unknown>) }
        : {};
    extra[targetKey.slice('extra.'.length)] = value;
    next.tripDetails = { ...next.tripDetails, extra };
  }
  return next;
}

export function replaceTravellerDocument(
  traveller: StoredTraveller,
  slotKey: string,
  doc: StoredTravellerDoc
): StoredTraveller {
  const documents = [...(traveller.documents ?? [])];
  const index = documents.findIndex((item) => item.slotKey === slotKey);
  if (index >= 0) documents[index] = doc;
  else documents.push(doc);
  return { ...traveller, documents };
}

export function validateFieldValue(
  config: ApplyFormConfig | null,
  targetKey: string,
  value: string
): string | null {
  const trimmed = value.trim();
  if (targetKey.startsWith('passport.')) {
    const field = targetKey.slice('passport.'.length);
    const shape = indianPassportFieldsSchema.shape as Record<
      string,
      z.ZodType
    >;
    const parser = shape[field];
    if (!parser) return 'Unknown passport field';
    const parsed = parser.safeParse(trimmed === '' ? undefined : trimmed);
    if (!parsed.success) {
      return parsed.error.issues[0]?.message ?? 'Invalid value';
    }
    return null;
  }

  if (targetKey.startsWith('trip.')) {
    const field = targetKey.slice('trip.'.length);
    if (!TRIP_FIELDS.some((item) => item.key === field)) {
      return 'Unknown trip field';
    }
    if (!trimmed) return 'This field is required';
    if (FUTURE_TRIP_FIELDS.has(field)) {
      if (!isIsoDate(trimmed)) return 'Enter a valid date';
      if (trimmed < earliestFutureDateIso()) {
        return 'Date must be in the future';
      }
    }
    return null;
  }

  if (targetKey.startsWith('extra.')) {
    const field = targetKey.slice('extra.'.length);
    const question = (config?.extraQuestions ?? []).find(
      (item) => item.key === field
    );
    return validateExtraAnswer(question, trimmed);
  }

  return 'Unknown field';
}

function validateExtraAnswer(
  question: ApplyTripQuestion | undefined,
  value: string
): string | null {
  if (!value) return 'This answer is required';
  if (!question) return null;
  if (question.type === 'boolean' && value !== 'true' && value !== 'false') {
    return 'Choose yes or no';
  }
  if (question.type === 'date' && !isIsoDate(value)) {
    return 'Enter a valid date';
  }
  if (
    (question.type === 'dropdown' || question.type === 'radio') &&
    question.options?.length &&
    !question.options.some((option) => option.value === value)
  ) {
    return 'Choose one of the listed options';
  }
  return null;
}

export function allowedOpenKeys(
  items: Array<{ targetKey: string; status: string; kind: string }>
): Set<string> {
  return new Set(
    items.filter((item) => item.status === 'open').map((item) => item.targetKey)
  );
}

export async function reviewerAccessDenied(
  userId: string,
  role: string | undefined,
  applicationId: string
): Promise<boolean> {
  if (role !== 'reviewer') return false;
  return !(await reviewerOwnsVisa(userId, applicationId));
}

export async function getOpenCorrection(
  applicationId: string,
  travellerId: string
) {
  const [request] = await db
    .select()
    .from(correctionRequests)
    .where(
      and(
        eq(correctionRequests.applicationId, applicationId),
        eq(correctionRequests.travellerId, travellerId),
        eq(correctionRequests.status, 'open')
      )
    )
    .limit(1);

  if (!request) return null;

  const items = await db
    .select()
    .from(correctionItems)
    .where(eq(correctionItems.requestId, request.id));

  return { request, items };
}

export interface CommentView {
  id: string;
  body: string;
  authorRole: string;
  authorName: string;
  createdAt: Date;
  travellerId: string | null;
}

export async function listComments(applicationId: string): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: applicationComments.id,
      body: applicationComments.body,
      authorRole: applicationComments.authorRole,
      authorName: users.name,
      createdAt: applicationComments.createdAt,
      travellerId: applicationComments.travellerId,
    })
    .from(applicationComments)
    .leftJoin(users, eq(applicationComments.authorId, users.id))
    .where(eq(applicationComments.applicationId, applicationId))
    .orderBy(desc(applicationComments.createdAt));

  return rows.map((row) => ({
    ...row,
    authorName: row.authorName || 'Unknown',
  }));
}

export interface CorrectionRoundView {
  id: string;
  status: string;
  message: string;
  travellerName: string;
  createdAt: Date;
  resubmittedAt: Date | null;
  resolvedAt: Date | null;
  items: Array<{
    id: string;
    kind: string;
    targetKey: string;
    label: string;
    comment: string;
    status: string;
    previousValue: unknown;
    newValue: unknown;
  }>;
}

export async function listCorrectionRounds(
  applicationId: string,
  config: ApplyFormConfig | null
): Promise<CorrectionRoundView[]> {
  const requests = await db
    .select({
      id: correctionRequests.id,
      status: correctionRequests.status,
      message: correctionRequests.message,
      travellerName: visaApplicationTravellers.name,
      createdAt: correctionRequests.createdAt,
      resubmittedAt: correctionRequests.resubmittedAt,
      resolvedAt: correctionRequests.resolvedAt,
    })
    .from(correctionRequests)
    .innerJoin(
      visaApplicationTravellers,
      eq(correctionRequests.travellerId, visaApplicationTravellers.id)
    )
    .where(eq(correctionRequests.applicationId, applicationId))
    .orderBy(desc(correctionRequests.createdAt));

  if (requests.length === 0) return [];

  const itemRows = await db
    .select({
      id: correctionItems.id,
      requestId: correctionItems.requestId,
      kind: correctionItems.kind,
      targetKey: correctionItems.targetKey,
      comment: correctionItems.comment,
      status: correctionItems.status,
      previousValue: correctionItems.previousValue,
      newValue: correctionItems.newValue,
    })
    .from(correctionItems)
    .innerJoin(
      correctionRequests,
      eq(correctionItems.requestId, correctionRequests.id)
    )
    .where(eq(correctionRequests.applicationId, applicationId));

  return requests.map((request) => ({
    ...request,
    items: itemRows
      .filter((item) => item.requestId === request.id)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        targetKey: item.targetKey,
        label: labelForTarget(config, item.targetKey),
        comment: item.comment,
        status: item.status,
        previousValue: item.previousValue,
        newValue: item.newValue,
      })),
  }));
}

export interface ApplicantActionItem {
  applicationId: string;
  travellerId: string;
  travellerName: string;
  country: string;
  visaType: string;
  message: string;
  items: Array<{ targetKey: string; label: string; comment: string; kind: string }>;
}

export async function listApplicantActionItems(
  userId: string
): Promise<ApplicantActionItem[]> {
  const rows = await db
    .select({
      applicationId: correctionRequests.applicationId,
      travellerId: correctionRequests.travellerId,
      message: correctionRequests.message,
      travellerName: visaApplicationTravellers.name,
      country: visaApplications.country,
      countryCode: visaApplications.countryCode,
      visaType: visaApplications.visaType,
      formSnapshot: visaApplications.formSnapshot,
      targetKey: correctionItems.targetKey,
      comment: correctionItems.comment,
      kind: correctionItems.kind,
    })
    .from(correctionRequests)
    .innerJoin(
      visaApplications,
      eq(correctionRequests.applicationId, visaApplications.id)
    )
    .innerJoin(
      visaApplicationTravellers,
      eq(correctionRequests.travellerId, visaApplicationTravellers.id)
    )
    .innerJoin(
      correctionItems,
      eq(correctionItems.requestId, correctionRequests.id)
    )
    .where(
      and(
        eq(visaApplications.userId, userId),
        eq(correctionRequests.status, 'open'),
        eq(correctionItems.status, 'open')
      )
    )
    .orderBy(desc(correctionRequests.createdAt));

  const grouped = new Map<string, ApplicantActionItem>();
  for (const row of rows) {
    const key = `${row.applicationId}:${row.travellerId}`;
    const config = (row.formSnapshot as ApplyFormConfig | null) ?? null;
    const current = grouped.get(key) ?? {
      applicationId: row.applicationId,
      travellerId: row.travellerId,
      travellerName: row.travellerName,
      country: row.country || row.countryCode || 'Visa',
      visaType: row.visaType,
      message: row.message,
      items: [],
    };
    current.items.push({
      targetKey: row.targetKey,
      label: labelForTarget(config, row.targetKey),
      comment: row.comment,
      kind: row.kind,
    });
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export interface StaffAttentionItem {
  applicationId: string;
  title: string;
  body: string;
  href: string;
}

export async function listStaffAttention(input: {
  staffUserId: string;
  reviewerId: string | null;
}): Promise<StaffAttentionItem[]> {
  const resubmitted = await db
    .select({
      applicationId: correctionRequests.applicationId,
      applicantName: visaApplications.applicantName,
      country: visaApplications.country,
      visaType: visaApplications.visaType,
      travellerName: visaApplicationTravellers.name,
    })
    .from(correctionRequests)
    .innerJoin(
      visaApplications,
      eq(correctionRequests.applicationId, visaApplications.id)
    )
    .innerJoin(
      visaApplicationTravellers,
      eq(correctionRequests.travellerId, visaApplicationTravellers.id)
    )
    .where(
      and(
        eq(correctionRequests.status, 'resubmitted'),
        input.reviewerId
          ? eq(visaApplications.assignedReviewerId, input.reviewerId)
          : undefined
      )
    )
    .orderBy(desc(correctionRequests.resubmittedAt));

  const unreadComments = await db
    .select({
      applicationId: notifications.applicationId,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, input.staffUserId),
        eq(notifications.type, 'applicant_comment'),
        isNull(notifications.readAt)
      )
    )
    .orderBy(desc(notifications.createdAt));

  const byApplication = new Map<string, StaffAttentionItem>();
  for (const row of resubmitted) {
    byApplication.set(row.applicationId, {
      applicationId: row.applicationId,
      title: `${row.applicantName || row.travellerName} sent updates`,
      body: `${row.country || 'Visa'} · ${row.visaType}. Review the corrected ${row.travellerName} file.`,
      href: `/admin/applications/visa/${row.applicationId}`,
    });
  }
  for (const row of unreadComments) {
    if (!row.applicationId || byApplication.has(row.applicationId)) continue;
    byApplication.set(row.applicationId, {
      applicationId: row.applicationId,
      title: row.title,
      body: row.body,
      href: row.href,
    });
  }
  return [...byApplication.values()];
}
