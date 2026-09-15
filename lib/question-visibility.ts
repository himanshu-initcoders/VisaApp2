import { z } from 'zod';

/**
 * Show-if visibility for additional questions (v1: single equals rule).
 * null / disabled = always visible.
 */
export const questionVisibilityRuleSchema = z.object({
  enabled: z.literal(true),
  sourceQuestionKey: z.string().min(1, 'Select a question'),
  operator: z.literal('equals'),
  value: z.string().min(1, 'Enter a value to match'),
});

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
      operator: z.literal('equals'),
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
  const parsed = questionVisibilityRuleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
  return sourceValue === rule.value.trim();
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
