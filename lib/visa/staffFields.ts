import type { ApplyFormConfig, ApplyTripQuestion } from '@/lib/apply/applicationForm';

/** Trip dates that must be in the future. Shared with field validation. */
export const STAFF_TRIP_DATE_FIELDS = new Set([
  'arrivalDate',
  'returnDate',
  'arrivalFlightDate',
  'returnFlightDate',
]);

const PASSPORT_DATE_FIELDS = new Set([
  'dateOfBirth',
  'dateOfIssue',
  'dateOfExpiry',
  'oldPassportDateOfIssue',
]);

const GENDER_OPTIONS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'X', label: 'Other' },
];

export type StaffFieldOption = { label: string; value: string };

export type StaffFieldControl =
  | { input: 'text' | 'textarea' | 'date' }
  | { input: 'select' | 'radio' | 'checkbox'; options: StaffFieldOption[] }
  | { input: 'boolean' }
  | { input: 'file' };

export interface StaffEditableTarget {
  kind: 'field' | 'document';
  targetKey: string;
  label: string;
  group: string;
  control: StaffFieldControl;
}

/**
 * Which control the staff edit dialog should show for a correctable target.
 * Unknown keys return null so the row stays read-only.
 */
export function staffFieldControl(
  config: ApplyFormConfig | null,
  targetKey: string
): StaffFieldControl | null {
  if (targetKey.startsWith('passport.')) {
    const field = targetKey.slice('passport.'.length);
    if (field === 'sex') return { input: 'select', options: GENDER_OPTIONS };
    if (field === 'address') return { input: 'textarea' };
    if (PASSPORT_DATE_FIELDS.has(field)) return { input: 'date' };
    return { input: 'text' };
  }

  if (targetKey.startsWith('trip.')) {
    const field = targetKey.slice('trip.'.length);
    if (field === 'accommodationAddress') return { input: 'textarea' };
    if (STAFF_TRIP_DATE_FIELDS.has(field)) return { input: 'date' };
    return { input: 'text' };
  }

  if (targetKey.startsWith('extra.')) {
    const field = targetKey.slice('extra.'.length);
    const question = (config?.extraQuestions ?? []).find(
      (item) => item.key === field
    );
    return controlForQuestion(question);
  }

  const isDocument =
    targetKey === 'passport-front' ||
    targetKey === 'passport-back' ||
    (config?.documentSlots ?? []).some((slot) => slot.key === targetKey);
  if (isDocument) return { input: 'file' };

  return null;
}

function controlForQuestion(
  question: ApplyTripQuestion | undefined
): StaffFieldControl {
  if (!question) return { input: 'text' };
  if (question.type === 'boolean') return { input: 'boolean' };
  if (question.type === 'date') return { input: 'date' };
  if (question.type === 'dropdown') {
    return { input: 'select', options: question.options ?? [] };
  }
  if (question.type === 'radio') {
    return { input: 'radio', options: question.options ?? [] };
  }
  if (question.type === 'checkbox') {
    return { input: 'checkbox', options: question.options ?? [] };
  }
  return { input: 'text' };
}
