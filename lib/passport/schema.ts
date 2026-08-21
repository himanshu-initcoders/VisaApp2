import { z } from 'zod';
import type { IndianPassportFields } from './types';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const indianPassportFieldsSchema = z.object({
  passportNumber: z
    .string()
    .min(6, 'Passport number is required')
    .max(12)
    .regex(/^[A-Z0-9]+$/i, 'Invalid passport number'),
  surname: z.string().min(1, 'Last name is required'),
  givenNames: z.string().min(1, 'First name is required'),
  nationality: z.string().default('IND'),
  dateOfBirth: dateString,
  sex: z.enum(['M', 'F', 'X'], { message: 'Select gender' }),
  dateOfExpiry: dateString,
  documentType: z.string().default('P'),
  countryOfIssue: z.string().default('IND'),
  fathersName: z.string().optional(),
  mothersName: z.string().optional(),
  spouseName: z.string().optional(),
  dateOfIssue: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Use YYYY-MM-DD'
    ),
  placeOfBirth: z.string().optional(),
  placeOfIssue: z.string().optional(),
  address: z.string().optional(),
  fileNumber: z.string().optional(),
  oldPassportNumber: z.string().optional(),
  oldPassportDateOfIssue: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Use YYYY-MM-DD'
    ),
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
