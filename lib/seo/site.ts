/**
 * Canonical public site identity for metadata, JSON-LD, and UI chrome.
 * Keep social URLs here so Footer, Organization sameAs, and SEO stay aligned.
 */

export const SITE_NAME = 'Viserv';

export const SITE_DESCRIPTION =
  'Visa and passport services for Indian citizens — clear pricing, guided applications, and expert review.';

/** Clean profile URLs (no tracking query params). */
export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/share/1cbfZ2NBYE/',
  instagram: 'https://www.instagram.com/viserv.visa',
  linkedin: 'https://www.linkedin.com/company/viserv-visa/',
} as const;

export type SocialNetwork = keyof typeof SOCIAL_LINKS;

/** Ordered list for UI + Organization.sameAs. */
export const SOCIAL_PROFILES = [
  { network: 'instagram' as const, label: 'Instagram', href: SOCIAL_LINKS.instagram },
  { network: 'linkedin' as const, label: 'LinkedIn', href: SOCIAL_LINKS.linkedin },
  { network: 'facebook' as const, label: 'Facebook', href: SOCIAL_LINKS.facebook },
];

export const SAME_AS = SOCIAL_PROFILES.map((profile) => profile.href);
