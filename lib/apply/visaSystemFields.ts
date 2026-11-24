/**
 * Built-in OCR / trip fields for visa Form Builder steps.
 * systemKey binds answers to passportData / tripDetails (not tripDetails.extra).
 */

import { questionCategoryLabel } from '@/lib/question-categories';

export const VISA_FORM_STEP_KINDS = ['ocr', 'trip', 'custom'] as const;
export type VisaFormStepKind = (typeof VISA_FORM_STEP_KINDS)[number];

/** Cannot be deleted from the OCR step. */
export const LOCKED_OCR_SYSTEM_KEYS = [
  'givenNames',
  'surname',
  'passportNumber',
] as const;

export type LockedOcrSystemKey = (typeof LOCKED_OCR_SYSTEM_KEYS)[number];

export function isLockedOcrSystemKey(
  systemKey: string | null | undefined
): systemKey is LockedOcrSystemKey {
  return (
    !!systemKey &&
    (LOCKED_OCR_SYSTEM_KEYS as readonly string[]).includes(systemKey)
  );
}

export type VisaSystemQuestionType =
  | 'text'
  | 'date'
  | 'dropdown'
  | 'radio'
  | 'boolean'
  | 'checkbox';

export type VisaSystemFieldDef = {
  systemKey: string;
  /** Storage key on additional_questions.key (stable, listing-unique). */
  key: string;
  label: string;
  description?: string;
  questionType: VisaSystemQuestionType;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
};

const GENDER_OPTIONS = [
  { label: 'Male', value: 'M' },
  { label: 'Female', value: 'F' },
  { label: 'Other', value: 'X' },
];

/** Default Personal details (OCR) questions — mirrors PASSPORT_REVIEW_GROUPS. */
export const DEFAULT_OCR_SYSTEM_FIELDS: VisaSystemFieldDef[] = [
  {
    systemKey: 'givenNames',
    key: 'sys.givenNames',
    label: 'First name',
    questionType: 'text',
    required: true,
  },
  {
    systemKey: 'surname',
    key: 'sys.surname',
    label: 'Last name',
    questionType: 'text',
    required: true,
  },
  {
    systemKey: 'fathersName',
    key: 'sys.fathersName',
    label: "Father's name",
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'mothersName',
    key: 'sys.mothersName',
    label: "Mother's name",
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'sex',
    key: 'sys.sex',
    label: 'Gender',
    questionType: 'dropdown',
    required: true,
    options: GENDER_OPTIONS,
  },
  {
    systemKey: 'dateOfBirth',
    key: 'sys.dateOfBirth',
    label: 'Date of birth',
    questionType: 'date',
    required: true,
  },
  {
    systemKey: 'placeOfBirth',
    key: 'sys.placeOfBirth',
    label: 'Place of birth',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'nationality',
    key: 'sys.nationality',
    label: 'Nationality',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'spouseName',
    key: 'sys.spouseName',
    label: "Spouse's name",
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'passportNumber',
    key: 'sys.passportNumber',
    label: 'Passport number',
    questionType: 'text',
    required: true,
  },
  {
    systemKey: 'dateOfIssue',
    key: 'sys.dateOfIssue',
    label: 'Issued on',
    questionType: 'date',
    required: false,
  },
  {
    systemKey: 'dateOfExpiry',
    key: 'sys.dateOfExpiry',
    label: 'Valid till',
    questionType: 'date',
    required: true,
  },
  {
    systemKey: 'placeOfIssue',
    key: 'sys.placeOfIssue',
    label: 'Place of issue',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'countryOfIssue',
    key: 'sys.countryOfIssue',
    label: 'Country of issue',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'address',
    key: 'sys.address',
    label: 'Address',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'email',
    key: 'sys.email',
    label: 'Email',
    questionType: 'text',
    required: true,
  },
  {
    systemKey: 'phone',
    key: 'sys.phone',
    label: 'Phone',
    questionType: 'text',
    required: true,
  },
];

/** Default Trip details questions — mirrors TripDetailsTab core fields. */
export const DEFAULT_TRIP_SYSTEM_FIELDS: VisaSystemFieldDef[] = [
  {
    systemKey: 'flightNumber',
    key: 'sys.flightNumber',
    label: 'Arrival flight number',
    questionType: 'text',
    required: true,
  },
  {
    systemKey: 'arrivalFlightDate',
    key: 'sys.arrivalFlightDate',
    label: 'Arrival date',
    questionType: 'date',
    required: true,
  },
  {
    systemKey: 'returnFlightNumber',
    key: 'sys.returnFlightNumber',
    label: 'Return flight number',
    questionType: 'text',
    required: true,
  },
  {
    systemKey: 'returnFlightDate',
    key: 'sys.returnFlightDate',
    label: 'Return departure date',
    questionType: 'date',
    required: true,
  },
  {
    systemKey: 'arrivalCity',
    key: 'sys.arrivalCity',
    label: 'Arrival city',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'accommodationName',
    key: 'sys.accommodationName',
    label: 'Hotel / accommodation name',
    questionType: 'text',
    required: false,
  },
  {
    systemKey: 'accommodationAddress',
    key: 'sys.accommodationAddress',
    label: 'Accommodation address',
    questionType: 'text',
    required: false,
  },
];

export const DEFAULT_OCR_STEP_TITLE = 'Personal details';
export const DEFAULT_TRIP_STEP_TITLE = 'Trip details';

export const OCR_PASSPORT_SYSTEM_KEYS = new Set(
  DEFAULT_OCR_SYSTEM_FIELDS.map((f) => f.systemKey)
);

export const TRIP_SYSTEM_KEYS = new Set(
  DEFAULT_TRIP_SYSTEM_FIELDS.map((f) => f.systemKey)
);

export function isOcrSystemKey(systemKey: string | null | undefined): boolean {
  return !!systemKey && OCR_PASSPORT_SYSTEM_KEYS.has(systemKey);
}

export function isTripSystemKey(systemKey: string | null | undefined): boolean {
  return !!systemKey && TRIP_SYSTEM_KEYS.has(systemKey);
}

/** Map legacy category slug → step title for migration. */
export function categoryToStepTitle(category: string): string {
  return questionCategoryLabel(category);
}
