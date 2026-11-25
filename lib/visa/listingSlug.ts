/**
 * Public visa-listing slugs.
 * Canonical form is lowercase hyphenated words: australia-tourism-visa.
 */

export const VISA_LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVisaListingUuid(value: string) {
  return UUID_PATTERN.test(value);
}

/**
 * Live typing helper: lowercase + hyphens, but keep a trailing `-`
 * so users can type the next word (full trim happens on blur/save).
 */
export function sanitizeVisaListingSlugInput(value: string) {
  const endsWithSeparator = /[^a-z0-9]$/i.test(value);
  const body = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .slice(0, 120);

  if (!body) return '';
  if (endsWithSeparator && body.length < 120 && !body.endsWith('-')) {
    return `${body}-`;
  }
  return body;
}

/** Final slug for save/suggest: lowercase hyphenated words, no leading/trailing `-`. */
export function normalizeVisaListingSlug(value: string) {
  return sanitizeVisaListingSlugInput(value)
    .replace(/-+$/g, '')
    .slice(0, 120);
}

/** Default slug from destination + purpose, e.g. Australia + tourism → australia-tourism-visa. */
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
