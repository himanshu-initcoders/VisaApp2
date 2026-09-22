import { z } from 'zod';

/**
 * Show-if visibility for additional questions.
 * Modes: equals (match value), is_empty (not filled/null), is_filled (any value).
 * null / disabled = always visible.
 */
export const QUESTION_VISIBILITY_OPERATORS = ['equals', 'is_empty', 'is_filled'] as const;
export type QuestionVisibilityOperator = (typeof QUESTION_VISIBILITY_OPERATORS)[number];

export const questionVisibilityOperatorSchema = z.enum(QUESTION_VISIBILITY_OPERATORS);

export const questionVisibilityRuleSchema = z
  .object({
    enabled: z.literal(true),
    sourceQuestionKey: z.string().min(1, 'Select a question'),
    operator: questionVisibilityOperatorSchema,
    value: z.string(),
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
  }));

/**
 * Form-friendly draft: allows empty strings while editing.
 * Final submit validation is enforced via refine on additionalQuestionSchema.
 */
export const questionVisibilityDraftSchema = z
  .union([
    z.null(),
    z.object({
      enabled: z.literal(true),
      sourceQuestionKey: z.string(),
      operator: questionVisibilityOperatorSchema.default('equals'),
      value: z.string(),
    }),
  ])
  .optional()
  .nullable();

export type QuestionVisibilityRule = z.infer<typeof questionVisibilityRuleSchema>;
export type QuestionVisibilityDraft = z.infer<typeof questionVisibilityDraftSchema>;
export type QuestionVisibility = QuestionVisibilityRule | null | undefined;

export type VisibilityAwareQuestion = {
  key: string;
  visibility?: QuestionVisibility;
};

/** Normalize stored jsonb / draft into a complete rule or null (always visible). */
export function normalizeQuestionVisibility(
  value: unknown
): QuestionVisibilityRule | null {
  if (!value || typeof value !== 'object') return null;

  // Legacy rows may omit operator; treat as equals.
  const raw = value as Record<string, unknown>;
  const withOperator =
    typeof raw.operator === 'string'
      ? value
      : { ...raw, operator: 'equals' };

  const parsed = questionVisibilityRuleSchema.safeParse(withOperator);
  return parsed.success ? parsed.data : null;
}

/**
 * Missing, whitespace-only, or empty checkbox JSON array [] counts as empty.
 * Boolean "false" is filled (an explicit answer).
 */
export function isAnswerEmpty(sourceValue: string): boolean {
  const trimmed = sourceValue.trim();
  if (!trimmed) return true;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.length === 0;
    }
  } catch {
    // not JSON
  }
  return false;
}

/**
 * Broken rules (missing source key) fall back to always visible.
 */
export function isQuestionVisible(
  question: VisibilityAwareQuestion,
  answers: Record<string, string>,
  knownKeys?: Set<string>
): boolean {
  const rule = normalizeQuestionVisibility(question.visibility);
  if (!rule) return true;

  if (knownKeys && !knownKeys.has(rule.sourceQuestionKey)) {
    return true;
  }

  const sourceValue = (answers[rule.sourceQuestionKey] ?? '').trim();

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

/** Exact match, or includes when source is a checkbox JSON array. */
export function answerMatchesEquals(sourceValue: string, ruleValue: string): boolean {
  if (!ruleValue) return false;
  try {
    const parsed = JSON.parse(sourceValue);
    if (Array.isArray(parsed)) {
      return parsed.map(String).includes(ruleValue);
    }
  } catch {
    // not JSON
  }
  return sourceValue === ruleValue;
}

export function getVisibleExtraQuestions<T extends VisibilityAwareQuestion>(
  questions: T[],
  answers: Record<string, string>
): T[] {
  const knownKeys = new Set(questions.map((q) => q.key));
  return questions.filter((question) =>
    isQuestionVisible(question, answers, knownKeys)
  );
}

/** Clear answers for questions that are no longer visible. */
export function clearHiddenQuestionAnswers<T extends VisibilityAwareQuestion>(
  questions: T[],
  answers: Record<string, string>
): Record<string, string> {
  const knownKeys = new Set(questions.map((q) => q.key));
  const next = { ...answers };
  let changed = false;

  for (const question of questions) {
    if (isQuestionVisible(question, answers, knownKeys)) continue;
    if (question.key in next) {
      delete next[question.key];
      changed = true;
    }
  }

  return changed ? next : answers;
}

/**
 * Reject self-dependency and 1-hop cycles (A depends on B and B depends on A).
 */
export function validateVisibilityAgainstSiblings(input: {
  questionKey?: string | null;
  visibility: QuestionVisibility;
  siblings: Array<{ key: string; visibility?: QuestionVisibility }>;
}): string | null {
  const rule = normalizeQuestionVisibility(input.visibility);
  if (!rule) return null;

  if (input.questionKey && rule.sourceQuestionKey === input.questionKey) {
    return 'A question cannot depend on itself';
  }

  const source = input.siblings.find((s) => s.key === rule.sourceQuestionKey);
  if (!source) {
    return 'Selected source question was not found on this listing';
  }

  const sourceRule = normalizeQuestionVisibility(source.visibility);
  if (
    input.questionKey &&
    sourceRule &&
    sourceRule.sourceQuestionKey === input.questionKey
  ) {
    return 'This would create a circular visibility dependency';
  }

  return null;
}

/** Keep suggestion visibility only if the source key exists on the current listing. */
export function adaptVisibilityForListing(
  visibility: QuestionVisibility,
  listingQuestionKeys: Set<string>
): QuestionVisibilityRule | null {
  const rule = normalizeQuestionVisibility(visibility);
  if (!rule) return null;
  if (!listingQuestionKeys.has(rule.sourceQuestionKey)) return null;
  return rule;
}
