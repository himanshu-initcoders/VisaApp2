import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  correctionItems,
  correctionRequests,
  passportServices,
  staffFieldEdits,
  users,
} from '@/lib/db/schema';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';
import { isIsoDate } from '@/lib/passport/schema';
import {
  correctionItemInputSchema,
  type CorrectableTarget,
  type CorrectionRoundView,
  type StaffFieldEditView,
} from '@/lib/visa/corrections';

export type { CorrectableTarget };

export const requestPassportCorrectionSchema = z.object({
  applicationId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  items: z.array(correctionItemInputSchema).min(1).max(40),
});

export const submitPassportCorrectionSchema = z.object({
  applicationId: z.string().uuid(),
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

export const staffPassportFieldEditSchema = z
  .object({
    applicationId: z.string().uuid(),
    targetKey: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
    value: z.string().max(8000).optional(),
    file: z
      .object({
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(100),
        bufferBase64: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasValue = data.value !== undefined;
    const hasFile = data.file !== undefined;
    if (hasValue === hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Send a new value or a replacement file',
      });
    }
  });

export type RequestPassportCorrectionInput = z.infer<
  typeof requestPassportCorrectionSchema
>;
export type SubmitPassportCorrectionInput = z.infer<
  typeof submitPassportCorrectionSchema
>;

export interface StoredPassportDocument {
  slotKey?: string;
  key?: string;
  url?: string;
  mimeType?: string;
  filename?: string;
  size?: number;
}

export function buildPassportCorrectableTargets(
  config: PassportApplyFormConfig | null
): CorrectableTarget[] {
  const targets: CorrectableTarget[] = [];
  for (const step of config?.steps ?? []) {
    for (const question of step.questions) {
      targets.push({
        kind: 'field',
        targetKey: question.key,
        label: question.label,
        group: step.title,
      });
    }
  }
  for (const slot of config?.documentSlots ?? []) {
    targets.push({
      kind: 'document',
      targetKey: slot.key,
      label: slot.label,
      group: 'Documents',
    });
  }
  return targets;
}

export function labelForPassportTarget(
  config: PassportApplyFormConfig | null,
  targetKey: string
): string {
  return (
    buildPassportCorrectableTargets(config).find(
      (item) => item.targetKey === targetKey
    )?.label ?? targetKey
  );
}

export function validatePassportRequestedItems(
  config: PassportApplyFormConfig | null,
  items: Array<{ kind: 'document' | 'field'; targetKey: string }>
): string | null {
  const allowed = new Map(
    buildPassportCorrectableTargets(config).map((item) => [
      item.targetKey,
      item.kind,
    ])
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

function findPassportQuestion(
  config: PassportApplyFormConfig | null,
  targetKey: string
) {
  for (const step of config?.steps ?? []) {
    const question = step.questions.find((item) => item.key === targetKey);
    if (question) return question;
  }
  return undefined;
}

export function readPassportAnswerValue(
  answers: Record<string, unknown> | null | undefined,
  targetKey: string
): unknown {
  const map = answers && typeof answers === 'object' ? answers : {};
  return map[targetKey] ?? '';
}

export function readPassportDocumentValue(
  documents: StoredPassportDocument[] | null | undefined,
  slotKey: string
): unknown {
  const doc = (documents ?? []).find((item) => item.slotKey === slotKey);
  if (!doc) return null;
  return {
    filename: doc.filename ?? null,
    key: doc.key ?? null,
    url: doc.url ?? null,
    mimeType: doc.mimeType ?? null,
  };
}

export function readPassportTargetValue(
  answers: Record<string, unknown> | null | undefined,
  documents: StoredPassportDocument[] | null | undefined,
  targetKey: string,
  kind: 'field' | 'document'
): unknown {
  if (kind === 'document') {
    return readPassportDocumentValue(documents, targetKey);
  }
  return readPassportAnswerValue(answers, targetKey);
}

export function writePassportAnswerValue(
  answers: Record<string, unknown>,
  targetKey: string,
  value: string
): Record<string, unknown> {
  return { ...answers, [targetKey]: value };
}

export function replacePassportDocument(
  documents: StoredPassportDocument[],
  slotKey: string,
  doc: StoredPassportDocument
): StoredPassportDocument[] {
  const next = [...documents];
  const index = next.findIndex((item) => item.slotKey === slotKey);
  const row = { ...doc, slotKey };
  if (index >= 0) next[index] = row;
  else next.push(row);
  return next;
}

export function validatePassportFieldValue(
  config: PassportApplyFormConfig | null,
  targetKey: string,
  value: string
): string | null {
  const trimmed = value.trim();
  const question = findPassportQuestion(config, targetKey);
  if (!question) return 'Unknown field';
  if (!trimmed && question.required) return 'This field is required';
  if (!trimmed) return null;

  switch (question.questionType) {
    case 'boolean':
      if (trimmed !== 'true' && trimmed !== 'false') return 'Choose yes or no';
      return null;
    case 'date':
      if (!isIsoDate(trimmed)) return 'Enter a valid date';
      return null;
    case 'dropdown':
    case 'radio':
      if (
        question.options?.length &&
        !question.options.some((option) => option.value === trimmed)
      ) {
        return 'Choose one of the listed options';
      }
      return null;
    case 'checkbox': {
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) return 'Invalid selection';
      } catch {
        return 'Invalid selection';
      }
      return null;
    }
    default:
      return null;
  }
}

export async function getOpenPassportCorrection(applicationId: string) {
  const [request] = await db
    .select()
    .from(correctionRequests)
    .where(
      and(
        eq(correctionRequests.applicationId, applicationId),
        eq(correctionRequests.applicationType, 'passport'),
        isNull(correctionRequests.travellerId),
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

export async function listPassportCorrectionRounds(
  applicationId: string,
  config: PassportApplyFormConfig | null
): Promise<CorrectionRoundView[]> {
  const requests = await db
    .select({
      id: correctionRequests.id,
      status: correctionRequests.status,
      message: correctionRequests.message,
      createdAt: correctionRequests.createdAt,
      resubmittedAt: correctionRequests.resubmittedAt,
      resolvedAt: correctionRequests.resolvedAt,
    })
    .from(correctionRequests)
    .where(
      and(
        eq(correctionRequests.applicationId, applicationId),
        eq(correctionRequests.applicationType, 'passport'),
        isNull(correctionRequests.travellerId)
      )
    )
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
    .where(
      and(
        eq(correctionRequests.applicationId, applicationId),
        eq(correctionRequests.applicationType, 'passport')
      )
    );

  return requests.map((request) => ({
    ...request,
    travellerName: 'Applicant',
    items: itemRows
      .filter((item) => item.requestId === request.id)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        targetKey: item.targetKey,
        label: labelForPassportTarget(config, item.targetKey),
        comment: item.comment,
        status: item.status,
        previousValue: item.previousValue,
        newValue: item.newValue,
      })),
  }));
}

export async function listPassportStaffFieldEdits(
  applicationId: string,
  config: PassportApplyFormConfig | null
): Promise<StaffFieldEditView[]> {
  const rows = await db
    .select({
      id: staffFieldEdits.id,
      kind: staffFieldEdits.kind,
      targetKey: staffFieldEdits.targetKey,
      message: staffFieldEdits.message,
      previousValue: staffFieldEdits.previousValue,
      newValue: staffFieldEdits.newValue,
      createdAt: staffFieldEdits.createdAt,
      actorName: users.name,
    })
    .from(staffFieldEdits)
    .leftJoin(users, eq(staffFieldEdits.actorId, users.id))
    .where(
      and(
        eq(staffFieldEdits.applicationId, applicationId),
        eq(staffFieldEdits.applicationType, 'passport')
      )
    )
    .orderBy(desc(staffFieldEdits.createdAt));

  return rows.map((row) => ({
    ...row,
    label: labelForPassportTarget(config, row.targetKey),
    actorName: row.actorName || 'Unknown',
    travellerName: 'Applicant',
  }));
}

export interface PassportApplicantActionItem {
  applicationId: string;
  travellerName: string;
  serviceLabel: string;
  productName: string;
  message: string;
  items: Array<{ targetKey: string; label: string; comment: string; kind: string }>;
}

export async function listPassportApplicantActionItems(
  userId: string
): Promise<PassportApplicantActionItem[]> {
  const rows = await db
    .select({
      applicationId: correctionRequests.applicationId,
      message: correctionRequests.message,
      serviceType: passportServices.serviceType,
      formSnapshot: passportServices.formSnapshot,
      referenceNumber: passportServices.referenceNumber,
      targetKey: correctionItems.targetKey,
      comment: correctionItems.comment,
      kind: correctionItems.kind,
    })
    .from(correctionRequests)
    .innerJoin(
      passportServices,
      eq(correctionRequests.applicationId, passportServices.id)
    )
    .innerJoin(
      correctionItems,
      eq(correctionItems.requestId, correctionRequests.id)
    )
    .where(
      and(
        eq(passportServices.userId, userId),
        eq(correctionRequests.applicationType, 'passport'),
        isNull(correctionRequests.travellerId),
        eq(correctionRequests.status, 'open'),
        eq(correctionItems.status, 'open')
      )
    )
    .orderBy(desc(correctionRequests.createdAt));

  const grouped = new Map<string, PassportApplicantActionItem>();
  for (const row of rows) {
    const key = row.applicationId;
    const config = (row.formSnapshot as PassportApplyFormConfig | null) ?? null;
    const productName =
      config?.productName ||
      (row.serviceType === 'reissue' ? 'Passport reissue' : 'New passport');
    const current = grouped.get(key) ?? {
      applicationId: row.applicationId,
      travellerName: 'Applicant',
      serviceLabel: 'Passport',
      productName,
      message: row.message,
      items: [],
    };
    current.items.push({
      targetKey: row.targetKey,
      label: labelForPassportTarget(config, row.targetKey),
      comment: row.comment,
      kind: row.kind,
    });
    grouped.set(key, current);
  }
  return [...grouped.values()];
}
