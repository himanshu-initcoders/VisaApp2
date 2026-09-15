import { z } from 'zod';
import {
  QUESTION_CATEGORIES,
  isQuestionCategory,
  type QuestionCategory,
} from '@/lib/question-categories';
import {
  DOCUMENT_TYPES,
  PASSPORT_DOCUMENT_TYPES,
  documentTypeLabel,
} from '@/lib/document-types';
import {
  getVisibleExtraQuestions,
  normalizeQuestionVisibility,
  type QuestionVisibility,
} from '@/lib/question-visibility';

export const APPLICATION_FORM_TABS = [
  { id: 'general', label: 'General details' },
  { id: 'trip', label: 'Trip details' },
  { id: 'additional', label: 'Additional questions' },
  { id: 'documents', label: 'Documents' },
  { id: 'review', label: 'Review & submit' },
] as const;

export type ApplicationFormTabId = (typeof APPLICATION_FORM_TABS)[number]['id'];

export const TRIP_PURPOSE_OPTIONS = [
  { value: 'tourism', label: 'Tourism' },
  { value: 'business', label: 'Business' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
  { value: 'family', label: 'Family visit' },
  { value: 'medical', label: 'Medical' },
  { value: 'transit', label: 'Transit' },
] as const;

export interface TravellerTripDetails {
  purpose: string;
  arrivalDate: string;
  returnDate: string;
  arrivalCity: string;
  accommodationName: string;
  accommodationAddress: string;
  flightNumber: string;
  extra: Record<string, string>;
}

export interface TravellerDocumentUpload {
  key: string;
  name: string;
  previewUrl: string;
  mimeType: string;
}

export interface ApplyTripQuestion {
  id: string;
  key: string;
  label: string;
  description?: string;
  category: QuestionCategory;
  type: 'text' | 'date' | 'dropdown' | 'boolean';
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  visibility?: QuestionVisibility;
}

export type ApplyTripQuestionGroup = {
  category: QuestionCategory;
  label: string;
  questions: ApplyTripQuestion[];
};

/** Group extra questions by category order defined in QUESTION_CATEGORIES. */
export function groupApplyTripQuestions(
  questions: ApplyTripQuestion[]
): ApplyTripQuestionGroup[] {
  const byCategory = new Map<QuestionCategory, ApplyTripQuestion[]>();

  for (const question of questions) {
    const category = isQuestionCategory(question.category)
      ? question.category
      : 'other';
    const list = byCategory.get(category) ?? [];
    list.push(question);
    byCategory.set(category, list);
  }

  return QUESTION_CATEGORIES.filter((entry) => byCategory.has(entry.value)).map(
    (entry) => ({
      category: entry.value,
      label: entry.label,
      questions: byCategory.get(entry.value)!,
    })
  );
}

export interface ApplyDocumentSlot {
  id: string;
  key: string;
  title: string;
  description: string;
  required: boolean;
  accept: string;
}

export interface ApplyFormConfig {
  purpose: string;
  countryName: string;
  processName: string;
  showGeneralInfo: boolean;
  showTripDetails: boolean;
  extraQuestions: ApplyTripQuestion[];
  documentSlots: ApplyDocumentSlot[];
}

export const DOCUMENT_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/jpg,application/pdf';

const PASSPORT_COMPONENT_KEYS = new Set([
  'passport',
  'passport_back',
  'passport_copy',
]);

const CORE_TRIP_QUESTION_KEYS = new Set([
  'purpose',
  'flight_number',
  'departure_flight',
  'arrival_date',
  'departure_date',
  'hotel',
  'hotel_name',
]);

const DOCUMENT_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type.value, type.label])
);

export function toIsoDate(raw: string | undefined) {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return '';
  const date = new Date(parsed);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizePurpose(value: string | undefined) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const byValue = TRIP_PURPOSE_OPTIONS.find((item) => item.value === lower);
  if (byValue) return byValue.value;
  const byLabel = TRIP_PURPOSE_OPTIONS.find(
    (item) => item.label.toLowerCase() === lower
  );
  return byLabel?.value ?? trimmed;
}

export function normalizeTripDetails(
  trip: TravellerTripDetails | undefined
): TravellerTripDetails {
  return emptyTripDetails(trip);
}

const isoDate = z.preprocess(
  (value) => toIsoDate(typeof value === 'string' ? value : ''),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
);

export const tripDetailsSchema = z
  .object({
    purpose: z.string().min(1, 'Select the purpose of visit'),
    arrivalDate: isoDate,
    returnDate: isoDate,
    arrivalCity: z.string().optional().default(''),
    accommodationName: z.string().optional().default(''),
    accommodationAddress: z.string().optional().default(''),
    flightNumber: z.string().optional().default(''),
    extra: z.record(z.string(), z.string()).default({}),
  })
  .refine(
    (value) => !value.arrivalDate || !value.returnDate || value.returnDate >= value.arrivalDate,
    {
      message: 'Return date should be on or after arrival',
      path: ['returnDate'],
    }
  );

export function emptyTripDetails(
  partial?: Partial<TravellerTripDetails>
): TravellerTripDetails {
  return {
    purpose: normalizePurpose(partial?.purpose),
    arrivalDate: toIsoDate(partial?.arrivalDate),
    returnDate: toIsoDate(partial?.returnDate),
    arrivalCity: partial?.arrivalCity ?? '',
    accommodationName: partial?.accommodationName ?? '',
    accommodationAddress: partial?.accommodationAddress ?? '',
    flightNumber: partial?.flightNumber ?? '',
    extra: { ...(partial?.extra ?? {}) },
  };
}

export function defaultApplyFormConfig(
  countryName = '',
  processName = '',
  purpose = ''
): ApplyFormConfig {
  return buildApplyFormConfig({
    purpose,
    countryName,
    processName,
    showGeneralInfo: true,
    showTripDetails: true,
    components: [],
    questions: [],
  });
}

export function formatDocumentTitle(
  key: string,
  options?: { label?: string | null; documentType?: string | null }
) {
  if (options?.label?.trim()) return options.label.trim();
  if (options?.documentType) return documentTypeLabel(options.documentType);
  return (
    DOCUMENT_LABELS[key] ||
    key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function isFileQuestionType(type: string) {
  return type === 'file' || type === 'file_upload';
}

function mapQuestionType(type: string): ApplyTripQuestion['type'] {
  if (type === 'date') return 'date';
  if (type === 'boolean') return 'boolean';
  // Legacy "select" rows are treated as dropdown
  if (type === 'select' || type === 'dropdown') return 'dropdown';
  return 'text';
}

export function buildApplyFormConfig(input: {
  purpose: string;
  countryName: string;
  processName: string;
  showGeneralInfo?: boolean | null;
  showTripDetails?: boolean | null;
  components: Array<{
    id: string;
    key: string;
    documentType?: string | null;
    label?: string | null;
    attributes?: string[] | null;
    sourceUrl?: string | null;
  }>;
  questions: Array<{
    id: string;
    key: string;
    label: string;
    description?: string | null;
    questionType: string;
    category?: string | null;
    required?: boolean | null;
    extraInfo?: string | null;
    options?: Array<{ label: string; value: string }> | null;
    visibility?: QuestionVisibility;
  }>;
}): ApplyFormConfig {
  const extraQuestions = input.questions
    .filter(
      (question) =>
        !isFileQuestionType(question.questionType) &&
        !CORE_TRIP_QUESTION_KEYS.has(question.key.toLowerCase())
    )
    .map((question) => {
      const rawCategory = question.category ?? 'other';
      return {
        id: question.id,
        key: question.key,
        label: question.label,
        description: question.description || question.extraInfo || undefined,
        category: isQuestionCategory(rawCategory) ? rawCategory : 'other',
        type: mapQuestionType(question.questionType),
        required: Boolean(question.required),
        options: question.options ?? undefined,
        visibility: normalizeQuestionVisibility(question.visibility),
      };
    });

  const fromComponents = input.components
    .filter((item) => {
      if (item.documentType && PASSPORT_DOCUMENT_TYPES.has(item.documentType)) {
        return false;
      }
      return !PASSPORT_COMPONENT_KEYS.has(item.key);
    })
    .map((item) => ({
      id: item.id,
      key: item.key,
      title: formatDocumentTitle(item.key, {
        label: item.label,
        documentType: item.documentType,
      }),
      description: 'Upload a clear JPG, PNG, or PDF.',
      required: true,
      accept: DOCUMENT_FILE_ACCEPT,
    }));

  const fromQuestions = input.questions
    .filter((question) => isFileQuestionType(question.questionType))
    .map((question) => ({
      id: question.id,
      key: question.key,
      title: question.label,
      description:
        question.description ||
        question.extraInfo ||
        'Upload a clear JPG, PNG, or PDF.',
      required: Boolean(question.required),
      accept: DOCUMENT_FILE_ACCEPT,
    }));

  const merged = [...fromComponents];
  for (const slot of fromQuestions) {
    if (!merged.some((item) => item.key === slot.key)) merged.push(slot);
  }

  const documentSlots =
    merged.length > 0
      ? merged
      : [
          {
            id: 'default-photo',
            key: 'photo',
            title: 'Passport photo',
            description: 'White background, face fully visible. ICAO-style photo recommended.',
            required: true,
            accept: DOCUMENT_FILE_ACCEPT,
          },
        ];

  return {
    purpose: input.purpose,
    countryName: input.countryName,
    processName: input.processName,
    showGeneralInfo: input.showGeneralInfo !== false,
    showTripDetails: input.showTripDetails !== false,
    extraQuestions,
    documentSlots,
  };
}

export function getCoreTripIssues(trip: TravellerTripDetails | undefined) {
  const normalized = normalizeTripDetails(trip);
  const issues: string[] = [];

  if (!normalized.purpose) {
    issues.push('Select the purpose of visit');
  }
  if (!normalized.arrivalDate) {
    issues.push('Enter the intended arrival date');
  }
  if (!normalized.returnDate) {
    issues.push('Enter the intended return date');
  }
  if (
    normalized.arrivalDate &&
    normalized.returnDate &&
    normalized.returnDate < normalized.arrivalDate
  ) {
    issues.push('Return date should be on or after arrival');
  }

  return issues;
}

export function getAdditionalQuestionIssues(
  trip: TravellerTripDetails | undefined,
  questions: ApplyTripQuestion[] = []
) {
  const normalized = normalizeTripDetails(trip);
  const issues: string[] = [];

  for (const question of getVisibleExtraQuestions(questions, normalized.extra)) {
    if (!question.required) continue;
    const value = normalized.extra[question.key]?.trim() ?? '';
    if (question.type === 'boolean') {
      if (value !== 'true' && value !== 'yes') {
        issues.push(`Confirm: ${question.label}`);
      }
      continue;
    }
    if (!value) issues.push(`Enter ${question.label}`);
  }

  return issues;
}

export function getTripIssues(
  trip: TravellerTripDetails | undefined,
  questions: ApplyTripQuestion[] = []
) {
  return [
    ...getCoreTripIssues(trip),
    ...getAdditionalQuestionIssues(trip, questions),
  ];
}

export function isCoreTripComplete(trip: TravellerTripDetails | undefined) {
  return getCoreTripIssues(trip).length === 0;
}

export function isAdditionalQuestionsComplete(
  trip: TravellerTripDetails | undefined,
  questions: ApplyTripQuestion[] = []
) {
  return getAdditionalQuestionIssues(trip, questions).length === 0;
}

export function isTripComplete(
  trip: TravellerTripDetails | undefined,
  questions: ApplyTripQuestion[] = []
) {
  return getTripIssues(trip, questions).length === 0;
}

export function isDocumentsComplete(
  uploads: TravellerDocumentUpload[] | undefined,
  slots: ApplyDocumentSlot[]
) {
  const byKey = new Map((uploads ?? []).map((item) => [item.key, item]));
  return slots
    .filter((slot) => slot.required)
    .every((slot) => Boolean(byKey.get(slot.key)?.previewUrl));
}

/** Tabs shown for this listing based on admin flags + configured questions. */
export function getVisibleApplicationTabs(
  config: Pick<
    ApplyFormConfig,
    'showGeneralInfo' | 'showTripDetails' | 'extraQuestions'
  >
): ApplicationFormTabId[] {
  const tabs: ApplicationFormTabId[] = [];
  if (config.showGeneralInfo) tabs.push('general');
  if (config.showTripDetails) tabs.push('trip');
  if (config.extraQuestions.length > 0) tabs.push('additional');
  tabs.push('documents', 'review');
  return tabs;
}

export function tabUnlockState(input: {
  visibleTabs: ApplicationFormTabId[];
  generalComplete: boolean;
  tripComplete: boolean;
  additionalComplete: boolean;
  documentsComplete: boolean;
}): Record<ApplicationFormTabId, boolean> {
  const complete: Record<ApplicationFormTabId, boolean> = {
    general: input.generalComplete,
    trip: input.tripComplete,
    additional: input.additionalComplete,
    documents: input.documentsComplete,
    review: true,
  };

  const unlocked: Record<ApplicationFormTabId, boolean> = {
    general: false,
    trip: false,
    additional: false,
    documents: false,
    review: false,
  };

  let priorComplete = true;
  for (const tab of input.visibleTabs) {
    unlocked[tab] = priorComplete;
    if (tab !== 'review') {
      priorComplete = priorComplete && complete[tab];
    }
  }

  return unlocked;
}

export function firstIncompleteTab(input: {
  visibleTabs: ApplicationFormTabId[];
  generalComplete: boolean;
  tripComplete: boolean;
  additionalComplete: boolean;
  documentsComplete: boolean;
}): ApplicationFormTabId {
  const complete: Record<ApplicationFormTabId, boolean> = {
    general: input.generalComplete,
    trip: input.tripComplete,
    additional: input.additionalComplete,
    documents: input.documentsComplete,
    review: true,
  };

  for (const tab of input.visibleTabs) {
    if (tab === 'review') return 'review';
    if (!complete[tab]) return tab;
  }

  return input.visibleTabs[input.visibleTabs.length - 1] ?? 'review';
}

export function isAllowedPassportFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    /\.(jpe?g|png|webp|pdf)$/i.test(file.name)
  );
}

export function isWithinUploadLimit(file: File) {
  const max = file.type === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  return file.size <= max;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function purposeLabel(value: string) {
  return TRIP_PURPOSE_OPTIONS.find((item) => item.value === value)?.label || value;
}
