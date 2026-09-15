import type { IndianPassportFields } from '@/lib/passport/types';
import type { ApplyTraveller } from '@/lib/apply/types';
import { isReviewComplete } from '@/lib/passport/schema';

export interface ReviewField {
  key: keyof IndianPassportFields;
  label: string;
}

export interface ReviewFieldGroup {
  title: string;
  fields: ReviewField[];
}

export const PASSPORT_REVIEW_GROUPS: ReviewFieldGroup[] = [
  {
    title: 'Personal details',
    fields: [
      { key: 'givenNames', label: 'First name' },
      { key: 'surname', label: 'Last name' },
      { key: 'fathersName', label: "Father's name" },
      { key: 'mothersName', label: "Mother's name" },
      { key: 'sex', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of birth' },
      { key: 'placeOfBirth', label: 'Place of birth' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'spouseName', label: "Spouse's name" },
    ],
  },
  {
    title: 'Passport',
    fields: [
      { key: 'passportNumber', label: 'Passport number' },
      { key: 'dateOfIssue', label: 'Issued on' },
      { key: 'dateOfExpiry', label: 'Valid till' },
      { key: 'placeOfIssue', label: 'Place of issue' },
      { key: 'countryOfIssue', label: 'Country of issue' },
    ],
  },
  {
    title: 'Address & previous passport',
    fields: [
      { key: 'address', label: 'Address' },
      { key: 'fileNumber', label: 'File number' },
      { key: 'oldPassportNumber', label: 'Old passport number' },
      { key: 'oldPassportDateOfIssue', label: 'Old passport issued on' },
      { key: 'oldPassportPlaceOfIssue', label: 'Old passport place of issue' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ],
  },
];

const GENDER_LABEL: Record<string, string> = {
  M: 'Male',
  F: 'Female',
  X: 'Other',
};

export function formatReviewDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatReviewValue(
  key: keyof IndianPassportFields,
  value: string | undefined
) {
  if (!value) return '';
  if (key === 'sex') return GENDER_LABEL[value] || value;
  if (key === 'phone') return `+91 ${value}`;
  if (
    key === 'dateOfBirth' ||
    key === 'dateOfIssue' ||
    key === 'dateOfExpiry' ||
    key === 'oldPassportDateOfIssue'
  ) {
    return formatReviewDate(value);
  }
  return value;
}

export function isTravellerFilled(traveller: ApplyTraveller) {
  if (traveller.applicationComplete) return true;
  return Boolean(
    traveller.passportUploaded &&
      traveller.passportData &&
      isReviewComplete(traveller.passportData)
  );
}

export function travellerDisplayName(traveller: ApplyTraveller, index: number) {
  const fromPassport = traveller.passportData
    ? `${traveller.passportData.givenNames} ${traveller.passportData.surname}`.trim()
    : '';
  return traveller.name || fromPassport || `Traveller ${index + 1}`;
}
