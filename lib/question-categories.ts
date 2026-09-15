/**
 * Hardcoded question categories for Form Builder / apply grouping.
 * Add new entries here only — values are stored on additional_questions.category.
 */
export const QUESTION_CATEGORIES = [
  { value: 'passenger_details', label: 'Passenger details' },
  { value: 'travel_details', label: 'Travel details' },
  { value: 'financial_information', label: 'Financial information' },
  { value: 'employment_education', label: 'Employment & education' },
  { value: 'family_details', label: 'Family details' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'other', label: 'Other' },
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number]['value'];

export const QUESTION_CATEGORY_VALUES = QUESTION_CATEGORIES.map((c) => c.value) as [
  QuestionCategory,
  ...QuestionCategory[],
];

export function questionCategoryLabel(value: string): string {
  const match = QUESTION_CATEGORIES.find((c) => c.value === value);
  return match?.label ?? value;
}

export function isQuestionCategory(value: string): value is QuestionCategory {
  return QUESTION_CATEGORY_VALUES.includes(value as QuestionCategory);
}

/** Category order for apply-form section grouping (index in QUESTION_CATEGORIES). */
export function questionCategorySortIndex(value: string): number {
  const index = QUESTION_CATEGORIES.findIndex((c) => c.value === value);
  return index === -1 ? QUESTION_CATEGORIES.length : index;
}
