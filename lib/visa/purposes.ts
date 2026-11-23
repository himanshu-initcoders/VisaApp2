/**
 * Shared visa-listing purpose values, labels, and public tab order.
 * Keep admin forms, validation, and public grouping in sync via this module.
 */

export const VISA_LISTING_PURPOSES = [
  'tourism',
  'business',
  'work',
  'study',
  'family',
  'medical',
  'transit',
  'visa_on_arrival',
] as const;

export type VisaListingPurpose = (typeof VISA_LISTING_PURPOSES)[number];

/** Public tab / filter order: tourism first, arrival card last. */
export const VISA_PURPOSE_TAB_ORDER: readonly VisaListingPurpose[] = [
  'tourism',
  'business',
  'work',
  'study',
  'family',
  'medical',
  'transit',
  'visa_on_arrival',
] as const;

export const VISA_PURPOSE_OPTIONS: ReadonlyArray<{
  value: VisaListingPurpose;
  label: string;
}> = [
  { value: 'tourism', label: 'Tourism' },
  { value: 'business', label: 'Business' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
  { value: 'family', label: 'Family' },
  { value: 'medical', label: 'Medical' },
  { value: 'transit', label: 'Transit' },
  { value: 'visa_on_arrival', label: 'Arrival Card' },
];

const PURPOSE_LABELS: Record<VisaListingPurpose, string> = {
  tourism: 'Tourism',
  business: 'Business',
  work: 'Work',
  study: 'Study',
  family: 'Family',
  medical: 'Medical',
  transit: 'Transit',
  visa_on_arrival: 'Arrival Card',
};

/** Short purpose label for admin / filters (no trailing "Visa"). */
export function visaPurposeLabel(purpose: string): string {
  const key = purpose.toLowerCase() as VisaListingPurpose;
  if (key in PURPOSE_LABELS) return PURPOSE_LABELS[key];
  return purpose
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Tab label on public listing pages (e.g. Tourism → Tourist Visa). */
export function visaPurposeTabLabel(purpose: string): string {
  const key = purpose.toLowerCase();
  if (key === 'tourism') return 'Tourist Visa';
  if (key === 'visa_on_arrival') return 'Arrival Card';
  const base = visaPurposeLabel(purpose);
  return /visa/i.test(base) ? base : `${base} Visa`;
}

export function purposeTabSortIndex(purpose: string): number {
  const index = VISA_PURPOSE_TAB_ORDER.indexOf(
    purpose.toLowerCase() as VisaListingPurpose
  );
  return index === -1 ? VISA_PURPOSE_TAB_ORDER.length : index;
}

/**
 * Country cards / default redirects: tourism → business → remaining purposes.
 * Within the same purpose, prefer the lower starting price.
 */
export function pickPreferredCountryListing<
  T extends { purpose?: string | null; startingPrice?: number | null },
>(listings: readonly T[]): T | undefined {
  if (listings.length === 0) return undefined;

  return [...listings].sort((a, b) => {
    const purposeDiff =
      purposeTabSortIndex(a.purpose ?? '') -
      purposeTabSortIndex(b.purpose ?? '');
    if (purposeDiff !== 0) return purposeDiff;
    return (a.startingPrice ?? 0) - (b.startingPrice ?? 0);
  })[0];
}
