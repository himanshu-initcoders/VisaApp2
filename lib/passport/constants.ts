export const PASSPORT_SERVICE_TYPES = [
  { value: 'fresh', label: 'Fresh passport' },
  { value: 'reissue', label: 'Re-issue' },
] as const;

export type PassportServiceType =
  (typeof PASSPORT_SERVICE_TYPES)[number]['value'];

export const PASSPORT_SCHEMES = [
  { value: 'normal', label: 'Normal' },
  { value: 'tatkaal', label: 'Tatkaal' },
] as const;

export type PassportScheme = (typeof PASSPORT_SCHEMES)[number]['value'];

export const PASSPORT_BOOKLET_PAGES = [
  { value: '36', label: '36 pages' },
  { value: '60', label: '60 pages' },
] as const;

export type PassportBookletPages =
  (typeof PASSPORT_BOOKLET_PAGES)[number]['value'];

export function isPassportServiceType(
  value: string
): value is PassportServiceType {
  return value === 'fresh' || value === 'reissue';
}

export function passportServiceTypeLabel(value: string): string {
  return (
    PASSPORT_SERVICE_TYPES.find((t) => t.value === value)?.label ?? value
  );
}

export function passportPriceLabel(
  scheme: string,
  bookletPages: string
): string {
  const schemeLabel =
    PASSPORT_SCHEMES.find((s) => s.value === scheme)?.label ?? scheme;
  return `${schemeLabel}, ${bookletPages} pages`;
}

/** Apply header label, e.g. "Fresh Indian passport · Normal · 36 pages". */
export function formatPassportApplyLabel(input: {
  serviceType: string;
  scheme?: string | null;
  bookletPages?: string | null;
}): string {
  const service =
    input.serviceType === 'fresh'
      ? 'Fresh Indian passport'
      : input.serviceType === 'reissue'
        ? 'Re-issue Indian passport'
        : `${passportServiceTypeLabel(input.serviceType)} Indian passport`;
  const schemeLabel = input.scheme
    ? PASSPORT_SCHEMES.find((s) => s.value === input.scheme)?.label ??
      input.scheme
    : null;
  const pagesLabel = input.bookletPages
    ? `${input.bookletPages} pages`
    : null;
  return [service, schemeLabel, pagesLabel].filter(Boolean).join(' · ');
}
