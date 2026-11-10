/** Client-safe constants for approved-visa delivery documents. */

export const VISA_OUTCOME_SLOT = 'visa_outcome';

export function visaOutcomeLabel(): string {
  return 'Visa document';
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return (mimeType || '').toLowerCase() === 'application/pdf';
}

export const VISA_OUTCOME_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;
