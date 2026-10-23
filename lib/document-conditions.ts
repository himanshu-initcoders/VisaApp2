import { z } from 'zod';
import {
  answerMatchesEquals,
  isAnswerEmpty,
  isQuestionVisible,
  QUESTION_VISIBILITY_OPERATORS,
  type QuestionVisibility,
  type QuestionVisibilityOperator,
  type VisibilityAwareQuestion,
} from '@/lib/question-visibility';

/**
 * Show/require documents when this question's answer matches.
 * null / disabled = no document gating from this question.
 */

export const DOCUMENT_CONDITION_OPERATORS = QUESTION_VISIBILITY_OPERATORS;
export type DocumentConditionOperator = QuestionVisibilityOperator;

export const documentConditionOperatorSchema = z.enum(DOCUMENT_CONDITION_OPERATORS);

export const documentConditionItemSchema = z.object({
  documentType: z.string().trim().min(1, 'Select a document type').max(80),
  required: z.boolean().default(true),
});

export const documentConditionsRuleSchema = z
  .object({
    enabled: z.literal(true),
    operator: documentConditionOperatorSchema,
    value: z.string(),
    documents: z.array(documentConditionItemSchema).min(1, 'Select at least one document type'),
  })
  .superRefine((data, ctx) => {
    if (data.operator === 'equals' && !data.value.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a value to match',
        path: ['value'],
      });
    }
  })
  .transform((data) => ({
    ...data,
    value: data.operator === 'equals' ? data.value : '',
    documents: data.documents.map((doc) => ({
      documentType: doc.documentType.trim(),
      // Optional-when-shown disabled for now — always required when visible.
      required: true,
      // required: doc.required !== false,
    })),
  }));

/**
 * Form-friendly draft: allows empty strings / empty docs while editing.
 * Final submit validation is enforced via refine on additionalQuestionSchema.
 */
export const documentConditionsDraftSchema = z
  .union([
    z.null(),
    z.object({
      enabled: z.literal(true),
      operator: documentConditionOperatorSchema.default('equals'),
      value: z.string(),
      documents: z
        .array(
          z.object({
            documentType: z.string(),
            required: z.boolean().optional().default(true),
          })
        )
        .default([]),
    }),
  ])
  .optional()
  .nullable();

export type DocumentConditionsRule = z.infer<typeof documentConditionsRuleSchema>;
export type DocumentConditionsDraft = z.infer<typeof documentConditionsDraftSchema>;
export type DocumentConditions = DocumentConditionsRule | null | undefined;

export type DocumentConditionAwareQuestion = VisibilityAwareQuestion & {
  documentConditions?: DocumentConditions;
};

/** Normalize stored jsonb / draft into a complete rule or null. */
export function normalizeDocumentConditions(value: unknown): DocumentConditionsRule | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const withOperator =
    typeof raw.operator === 'string' ? value : { ...raw, operator: 'equals' };

  const parsed = documentConditionsRuleSchema.safeParse(withOperator);
  return parsed.success ? parsed.data : null;
}

export function isDocumentConditionsDraftEnabled(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'enabled' in value &&
      (value as { enabled?: boolean }).enabled === true
  );
}

/**
 * True when this question is visible and its answer matches the document condition.
 */
export function isDocumentConditionActive(
  question: DocumentConditionAwareQuestion,
  answers: Record<string, string>,
  knownKeys?: Set<string>
): boolean {
  const rule = normalizeDocumentConditions(question.documentConditions);
  if (!rule) return false;

  if (!isQuestionVisible(question, answers, knownKeys)) {
    return false;
  }

  const sourceValue = (answers[question.key] ?? '').trim();

  switch (rule.operator) {
    case 'is_empty':
      return isAnswerEmpty(sourceValue);
    case 'is_filled':
      return !isAnswerEmpty(sourceValue);
    case 'equals':
    default:
      return answerMatchesEquals(sourceValue, rule.value.trim());
  }
}

export type DocumentSlotVisibility = {
  sourceQuestionKey: string;
  operator: DocumentConditionOperator;
  value: string;
};

export type ConditionalDocumentSlot = {
  key: string;
  documentType?: string | null;
  required: boolean;
  visibility?: DocumentSlotVisibility | null;
};

type GatingRule = {
  sourceQuestionKey: string;
  operator: DocumentConditionOperator;
  value: string;
  required: boolean;
};

/**
 * Build per-documentType gating rules from questions that have documentConditions.
 * A document type listed here is answer-gated; types never listed stay always visible.
 */
export function buildDocumentTypeGatingMap(
  questions: DocumentConditionAwareQuestion[]
): Map<string, GatingRule[]> {
  const map = new Map<string, GatingRule[]>();

  for (const question of questions) {
    const rule = normalizeDocumentConditions(question.documentConditions);
    if (!rule) continue;

    for (const doc of rule.documents) {
      const list = map.get(doc.documentType) ?? [];
      list.push({
        sourceQuestionKey: question.key,
        operator: rule.operator,
        value: rule.value,
        required: doc.required,
      });
      map.set(doc.documentType, list);
    }
  }

  return map;
}

/**
 * Filter document slots by answer-driven conditions.
 * Ungated slots always show. Gated slots show when any matching question rule is active.
 * Required = true if any active matching rule marks the doc required.
 */
export function getVisibleDocumentSlots<T extends ConditionalDocumentSlot>(
  slots: T[],
  questions: DocumentConditionAwareQuestion[],
  answers: Record<string, string>
): T[] {
  const knownKeys = new Set(questions.map((q) => q.key));
  const activeByQuestionKey = new Map<string, boolean>();

  for (const question of questions) {
    activeByQuestionKey.set(
      question.key,
      isDocumentConditionActive(question, answers, knownKeys)
    );
  }

  const result: T[] = [];

  for (const slot of slots) {
    // Slots without baked visibility are always-visible listing docs.
    if (!slot.visibility) {
      result.push(slot);
      continue;
    }

    const docType = slot.documentType ?? null;
    let anyActive = false;

    if (docType) {
      for (const question of questions) {
        const rule = normalizeDocumentConditions(question.documentConditions);
        if (!rule) continue;
        const match = rule.documents.find((d) => d.documentType === docType);
        if (!match) continue;
        if (activeByQuestionKey.get(question.key) !== true) continue;
        anyActive = true;
      }
    } else if (activeByQuestionKey.get(slot.visibility.sourceQuestionKey) === true) {
      anyActive = true;
    }

    if (!anyActive) continue;

    // Optional-when-shown disabled for now — always required when visible.
    result.push({
      ...slot,
      required: true,
    });
  }

  return result;
}

/** Drop uploads for slots that are no longer visible. */
export function clearHiddenDocumentUploads<T extends { key: string }>(
  uploads: T[],
  visibleSlots: Array<{ key: string }>
): T[] {
  const visibleKeys = new Set(visibleSlots.map((s) => s.key));
  const next = uploads.filter((upload) => visibleKeys.has(upload.key));
  return next.length === uploads.length ? uploads : next;
}

/** Adapt suggestion document conditions only if structure is valid. */
export function adaptDocumentConditionsForListing(
  conditions: DocumentConditions
): DocumentConditionsRule | null {
  return normalizeDocumentConditions(conditions);
}

export type { QuestionVisibility };
