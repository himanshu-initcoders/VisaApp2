/** Client-safe constants for approved-visa delivery documents. */

export const VISA_OUTCOME_SLOT = 'visa_outcome';
export const PASSPORT_OUTCOME_SLOT = 'passport_outcome';

export function visaOutcomeLabel(): string {
  return 'Visa document';
}

export function passportOutcomeLabel(): string {
  return 'Passport document';
}

export function isOutcomeDocumentSlot(documentType: string): boolean {
  return (
    documentType === VISA_OUTCOME_SLOT || documentType === PASSPORT_OUTCOME_SLOT
  );
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return (mimeType || '').toLowerCase() === 'application/pdf';
}

export function isImageMime(mimeType: string | null | undefined): boolean {
  const mime = (mimeType || '').toLowerCase();
  return (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp'
  );
}

/** PDF or image — allowed for WhatsApp media URL + email attachment delivery. */
export function isSendableVisaOutcomeMime(
  mimeType: string | null | undefined
): boolean {
  return isPdfMime(mimeType) || isImageMime(mimeType);
}

/** PDF by MIME or `.pdf` name — browsers (esp. Windows) often leave `File.type` empty. */
export function isPdfFile(file: {
  type?: string | null;
  name?: string | null;
}): boolean {
  if (isPdfMime(file.type)) return true;
  return /\.pdf$/i.test(file.name || '');
}

export function isImageFile(file: {
  type?: string | null;
  name?: string | null;
}): boolean {
  const mime = (file.type || '').toLowerCase();
  if (isImageMime(mime)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name || '');
}

/** True when the selected file can be sent on WhatsApp + email. */
export function isSendableVisaOutcomeFile(file: {
  type?: string | null;
  name?: string | null;
}): boolean {
  return isPdfFile(file) || isImageFile(file);
}

/** File extension for Twilio media path samples (must end with a suffix). */
export function waMediaPathExtension(
  mimeType: string | null | undefined
): 'pdf' | 'jpg' | 'png' | 'webp' {
  const mime = (mimeType || '').toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  return 'pdf';
}

export function normalizeVisaOutcomeMime(
  mimeType: string | null | undefined,
  filename?: string | null
): string {
  const mime = (mimeType || '').toLowerCase().trim();
  if (isPdfMime(mime) || isImageMime(mime)) {
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
  }
  if (/\.pdf$/i.test(filename || '')) return 'application/pdf';
  if (/\.png$/i.test(filename || '')) return 'image/png';
  if (/\.webp$/i.test(filename || '')) return 'image/webp';
  if (/\.jpe?g$/i.test(filename || '')) return 'image/jpeg';
  return mime || 'application/octet-stream';
}

export const VISA_OUTCOME_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;
