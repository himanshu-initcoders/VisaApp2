import {
  TRIP_PURPOSE_OPTIONS,
  parseCheckboxValues,
  toIsoDate,
  type ApplyFormConfig,
  type ApplyTripQuestion,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import { PASSPORT_REVIEW_GROUPS } from '@/lib/apply/reviewFields';
import { getVisibleExtraQuestions } from '@/lib/question-visibility';

export type ExtensionFieldOption = { label: string; value: string };

export type ExtensionField = {
  name: string;
  label: string;
  type: string;
  options?: ExtensionFieldOption[];
};

export type ExtensionSection = {
  name: string;
  formFields: ExtensionField[];
};

export type ExtensionSchemaResult = {
  schema: ExtensionSection[];
  data: Record<string, unknown>;
};

export type ExtensionStoredDocument = {
  slotKey?: string;
  filename?: string;
  key?: string;
};

export type ExtensionStoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Partial<TravellerTripDetails> | null;
  documents?: ExtensionStoredDocument[] | null;
};

const PASSPORT_DATE_KEYS = new Set([
  'dateOfBirth',
  'dateOfIssue',
  'dateOfExpiry',
  'oldPassportDateOfIssue',
]);

const SEX_OPTIONS: ExtensionFieldOption[] = [
  { label: 'Male', value: 'M' },
  { label: 'Female', value: 'F' },
  { label: 'Other', value: 'X' },
];

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function setIfPresent(
  data: Record<string, unknown>,
  name: string,
  value: unknown
) {
  if (value == null) return;
  if (typeof value === 'string' && value.trim() === '') return;
  if (Array.isArray(value) && value.length === 0) return;
  data[name] = value;
}

function passportField(
  key: string,
  label: string
): ExtensionField {
  const name = `passport.${key}`;
  if (key === 'sex') {
    return { name, label, type: 'select', options: SEX_OPTIONS };
  }
  if (PASSPORT_DATE_KEYS.has(key)) {
    return { name, label, type: 'date' };
  }
  if (key === 'email') return { name, label, type: 'email' };
  if (key === 'address') return { name, label, type: 'textarea' };
  return { name, label, type: 'text' };
}

function tripFields(
  trip: Partial<TravellerTripDetails> | null | undefined
): { fields: ExtensionField[]; data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  const fields: ExtensionField[] = [
    {
      name: 'trip.purpose',
      label: 'Purpose of travel',
      type: 'select',
      options: TRIP_PURPOSE_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    },
    { name: 'trip.arrivalDate', label: 'Arrival date', type: 'date' },
    { name: 'trip.returnDate', label: 'Return date', type: 'date' },
    { name: 'trip.arrivalCity', label: 'Arrival city', type: 'text' },
    { name: 'trip.accommodationName', label: 'Accommodation name', type: 'text' },
    {
      name: 'trip.accommodationAddress',
      label: 'Accommodation address',
      type: 'textarea',
    },
  ];

  setIfPresent(data, 'trip.purpose', str(trip?.purpose));
  setIfPresent(data, 'trip.arrivalDate', toIsoDate(trip?.arrivalDate));
  setIfPresent(data, 'trip.returnDate', toIsoDate(trip?.returnDate));
  setIfPresent(data, 'trip.arrivalCity', str(trip?.arrivalCity));
  setIfPresent(data, 'trip.accommodationName', str(trip?.accommodationName));
  setIfPresent(data, 'trip.accommodationAddress', str(trip?.accommodationAddress));

  const arrivalLegs =
    trip?.arrivalFlights && trip.arrivalFlights.length > 0
      ? trip.arrivalFlights
      : [
          {
            flightNumber: trip?.flightNumber ?? '',
            date: trip?.arrivalFlightDate ?? '',
          },
        ];
  const returnLegs =
    trip?.returnFlights && trip.returnFlights.length > 0
      ? trip.returnFlights
      : [
          {
            flightNumber: trip?.returnFlightNumber ?? '',
            date: trip?.returnFlightDate ?? '',
          },
        ];

  arrivalLegs.forEach((leg, index) => {
    const n = index + 1;
    const numberName = `trip.arrivalFlight${n}Number`;
    const dateName = `trip.arrivalFlight${n}Date`;
    fields.push(
      { name: numberName, label: `Arrival flight ${n} number`, type: 'text' },
      { name: dateName, label: `Arrival flight ${n} date`, type: 'date' }
    );
    setIfPresent(data, numberName, str(leg?.flightNumber));
    setIfPresent(data, dateName, toIsoDate(leg?.date));
  });

  returnLegs.forEach((leg, index) => {
    const n = index + 1;
    const numberName = `trip.returnFlight${n}Number`;
    const dateName = `trip.returnFlight${n}Date`;
    fields.push(
      { name: numberName, label: `Return flight ${n} number`, type: 'text' },
      { name: dateName, label: `Return flight ${n} date`, type: 'date' }
    );
    setIfPresent(data, numberName, str(leg?.flightNumber));
    setIfPresent(data, dateName, toIsoDate(leg?.date));
  });

  return { fields, data };
}

function questionField(question: ApplyTripQuestion): ExtensionField {
  const name = `extra.${question.key}`;
  const options = question.options?.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const type = question.type as string;

  if (type === 'date') return { name, label: question.label, type: 'date' };
  if (type === 'dropdown' || type === 'select') {
    return { name, label: question.label, type: 'select', options };
  }
  if (type === 'boolean') return { name, label: question.label, type: 'checkbox' };
  if (type === 'checkbox') {
    return options?.length
      ? { name, label: question.label, type: 'checkbox-group', options }
      : { name, label: question.label, type: 'checkbox' };
  }
  if (type === 'radio') {
    return { name, label: question.label, type: 'radio', options };
  }
  if (type === 'file' || type === 'file_upload') {
    return { name, label: question.label, type: 'file' };
  }
  return { name, label: question.label, type: 'text' };
}

function questionValue(
  question: ApplyTripQuestion,
  raw: string
): unknown {
  const type = question.type as string;
  if (type === 'boolean') {
    if (!raw) return undefined;
    return raw === 'true' || raw === 'yes' ? 'true' : 'false';
  }
  if (type === 'checkbox' && question.options?.length) {
    const selected = parseCheckboxValues(raw);
    return selected.length > 0 ? selected : undefined;
  }
  if (type === 'date') {
    const iso = toIsoDate(raw);
    return iso || undefined;
  }
  return raw || undefined;
}

function extraAnswers(
  trip: Partial<TravellerTripDetails> | null | undefined
): Record<string, string> {
  const answers: Record<string, string> = {};
  const extra = trip?.extra;
  if (!extra || typeof extra !== 'object') return answers;
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === 'string') answers[key] = value;
  }
  return answers;
}

/**
 * Turn one traveller and the frozen listing form into the sections and
 * flat values FormBridge fills. Pass traveller=null to list every question
 * for mapping a published form before an applicant exists.
 */
export function buildVisaExtensionSchema(
  config: ApplyFormConfig,
  traveller: ExtensionStoredTraveller | null
): ExtensionSchemaResult {
  const schema: ExtensionSection[] = [];
  const data: Record<string, unknown> = {};
  const passport = traveller?.passportData ?? {};

  for (const group of PASSPORT_REVIEW_GROUPS) {
    const formFields = group.fields.map((field) => {
      const built = passportField(field.key, field.label);
      setIfPresent(data, built.name, str(passport[field.key]));
      return built;
    });
    if (formFields.length > 0) {
      schema.push({ name: group.title, formFields });
    }
  }

  if (config.showTripDetails !== false) {
    const trip = tripFields(traveller?.tripDetails);
    schema.push({ name: 'Trip details', formFields: trip.fields });
    Object.assign(data, trip.data);
  }

  const answers = extraAnswers(traveller?.tripDetails);
  const questions = Array.isArray(config.extraQuestions)
    ? config.extraQuestions
    : [];
  const visible = traveller
    ? getVisibleExtraQuestions(questions, answers)
    : questions;

  if (visible.length > 0) {
    const fields = visible.map(questionField);
    schema.push({ name: 'Additional questions', formFields: fields });
    if (traveller) {
      for (const question of visible) {
        const raw = answers[question.key] ?? answers[question.id] ?? '';
        setIfPresent(data, `extra.${question.key}`, questionValue(question, raw));
      }
    }
  }

  const slots = Array.isArray(config.documentSlots) ? config.documentSlots : [];
  if (slots.length > 0) {
    const docs = traveller?.documents ?? [];
    schema.push({
      name: 'Documents',
      formFields: slots.map((slot) => ({
        name: `doc.${slot.key}`,
        label: slot.title || slot.key,
        type: 'file',
      })),
    });
    for (const slot of slots) {
      const match = docs.find((doc) => doc.slotKey === slot.key);
      setIfPresent(data, `doc.${slot.key}`, str(match?.filename));
    }
  }

  return { schema, data };
}

export function asApplyFormConfig(raw: unknown): ApplyFormConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      purpose: '',
      countryName: '',
      processName: '',
      showGeneralInfo: true,
      showTripDetails: true,
      extraQuestions: [],
      documentSlots: [],
    };
  }
  const config = raw as Partial<ApplyFormConfig>;
  return {
    purpose: typeof config.purpose === 'string' ? config.purpose : '',
    countryName: typeof config.countryName === 'string' ? config.countryName : '',
    processName: typeof config.processName === 'string' ? config.processName : '',
    showGeneralInfo: config.showGeneralInfo !== false,
    showTripDetails: config.showTripDetails !== false,
    extraQuestions: Array.isArray(config.extraQuestions) ? config.extraQuestions : [],
    documentSlots: Array.isArray(config.documentSlots) ? config.documentSlots : [],
  };
}
