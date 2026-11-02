/**
 * Public visa-listing slugs.
 * Canonical form is title case with hyphens: Japan-Tourism-Visa.
 */

export const VISA_LISTING_SLUG_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVisaListingUuid(value: string) {
  return UUID_PATTERN.test(value);
}

const SLUG_ACRONYMS = new Set(['USA', 'UAE', 'UK', 'US', 'EU', 'UN']);

function slugPart(part: string) {
  const upper = part.toUpperCase();
  if (SLUG_ACRONYMS.has(upper)) return upper;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/** Turn free text into a title-case hyphenated slug. */
export function normalizeVisaListingSlug(value: string) {
  const parts = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(slugPart);

  return parts.join('-').slice(0, 120).replace(/-+$/g, '');
}

/** Default slug from destination + purpose, e.g. Japan + tourism → Japan-Tourism-Visa. */
export function suggestVisaListingSlug(input: {
  countryName: string;
  purpose: string;
}) {
  const purpose = input.purpose.replace(/_/g, ' ');
  const kind = /visa/i.test(purpose) ? purpose : `${purpose} Visa`;
  return normalizeVisaListingSlug(`${input.countryName} ${kind}`);
}

export function withSearchQuery(path: string, query: object) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      if (value) params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item) params.append(key, item);
      }
    }
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
