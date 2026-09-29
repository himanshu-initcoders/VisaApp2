import { z } from 'zod';
import type { IndianPassportFields } from './types';

/** Calendar day in India (IST), as YYYY-MM-DD. */
export function todayIsoIST(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(now);
}

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Latest date allowed for DOB and passport issue dates (yesterday, IST). */
export function latestPastDateIso(now = new Date()): string {
  return shiftIsoDate(todayIsoIST(now), -1);
}

/** Earliest date allowed for passport expiry (tomorrow, IST). */
export function earliestFutureDateIso(now = new Date()): string {
  return shiftIsoDate(todayIsoIST(now), 1);
}

export function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function pastDateError(value: string | undefined): string | null {
  if (!value) return null;
  if (!isIsoDate(value)) return 'Use a valid date';
  if (value > latestPastDateIso()) return 'Must be a past date';
  return null;
}

export function futureDateError(value: string | undefined): string | null {
  if (!value) return null;
  if (!isIsoDate(value)) return 'Use a valid date';
  if (value < earliestFutureDateIso()) return 'Must be a future date';
  return null;
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const pastDate = dateString.refine(
  (value) => value <= latestPastDateIso(),
  'Must be a past date'
);

const optionalPastDate = z
  .string()
  .optional()
  .refine(
    (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && value <= latestPastDateIso()),
    'Must be a past date'
  );

const futureDate = dateString.refine(
  (value) => value >= earliestFutureDateIso(),
  'Must be a future date'
);

export const indianPassportFieldsSchema = z.object({
  passportNumber: z
    .string()
    .min(6, 'Passport number is required')
    .max(12)
    .regex(/^[A-Z0-9]+$/i, 'Invalid passport number'),
  surname: z.string().min(1, 'Last name is required'),
  givenNames: z.string().min(1, 'First name is required'),
  nationality: z.string().default('IND'),
  dateOfBirth: pastDate,
  sex: z.enum(['M', 'F', 'X'], { message: 'Select gender' }),
  dateOfExpiry: futureDate,
  documentType: z.string().default('P'),
  countryOfIssue: z.string().default('IND'),
  fathersName: z.string().optional(),
  mothersName: z.string().optional(),
  spouseName: z.string().optional(),
  dateOfIssue: optionalPastDate,
  placeOfBirth: z.string().optional(),
  placeOfIssue: z.string().optional(),
  address: z.string().optional(),
  fileNumber: z.string().optional(),
  oldPassportNumber: z.string().optional(),
  oldPassportDateOfIssue: optionalPastDate,
  oldPassportPlaceOfIssue: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  phone: z
    .string()
    .min(10, 'Enter a valid phone number')
    .regex(/^\d{10}$/, 'Enter 10-digit Indian mobile number'),
});

export type IndianPassportReviewInput = z.infer<typeof indianPassportFieldsSchema>;

export function isReviewComplete(data: Partial<IndianPassportFields>) {
  const parsed = indianPassportFieldsSchema.safeParse({
    passportNumber: data.passportNumber || '',
    surname: data.surname || '',
    givenNames: data.givenNames || '',
    nationality: data.nationality || 'IND',
    dateOfBirth: data.dateOfBirth || '',
    sex:
      data.sex === 'M' || data.sex === 'F' || data.sex === 'X'
        ? data.sex
        : undefined,
    dateOfExpiry: data.dateOfExpiry || '',
    documentType: data.documentType || 'P',
    countryOfIssue: data.countryOfIssue || 'IND',
    fathersName: data.fathersName,
    mothersName: data.mothersName,
    spouseName: data.spouseName,
    dateOfIssue: data.dateOfIssue || undefined,
    placeOfBirth: data.placeOfBirth,
    placeOfIssue: data.placeOfIssue,
    address: data.address,
    fileNumber: data.fileNumber,
    oldPassportNumber: data.oldPassportNumber,
    oldPassportDateOfIssue: data.oldPassportDateOfIssue || undefined,
    oldPassportPlaceOfIssue: data.oldPassportPlaceOfIssue,
    email: data.email || '',
    phone: data.phone || '',
  });
  return parsed.success;
}
