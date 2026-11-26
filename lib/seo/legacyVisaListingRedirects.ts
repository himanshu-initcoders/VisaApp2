/**
 * Retired / renamed public visa listing paths → current canonical paths.
 * Used by next.config redirects (301) so indexed Google URLs do not 404.
 *
 * Destinations must match live lowercase `visa_listings.slug` values.
 *
 * IMPORTANT — Next.js `redirects()` matching is case-insensitive. Never add a
 * rule whose lowercase source equals the destination (e.g. Title-Case → same
 * lowercase slug). That creates an infinite 301 loop on the live URL.
 * Case-only canonicalization belongs in `proxy.ts` (compares raw vs lowercased).
 *
 * Only list rules where the *slug itself* changed (typo / rename / retirement).
 */
export const LEGACY_VISA_LISTING_REDIRECTS: ReadonlyArray<{
  source: string;
  destination: string;
}> = [
  // Australia — alternate Arrival Card paths → live typo slug
  {
    source: '/visa/au/Australia-Arrival-Card',
    destination: '/visa/au/australia-visa-on-arrivel',
  },
  {
    source: '/visa/au/australia-arrival-card',
    destination: '/visa/au/australia-visa-on-arrivel',
  },
  // Australia — retired Sub-Class listing → remaining Business
  {
    source: '/visa/au/Australia-Sub-Class-1000',
    destination: '/visa/au/australia-business-visa',
  },
  {
    source: '/visa/au/australia-sub-class-1000',
    destination: '/visa/au/australia-business-visa',
  },
  // Thailand — mistyped "tourist" slug (never shipped in DB) → live tourism
  {
    source: '/visa/th/Thailand-Tourist-Visa',
    destination: '/visa/th/thailand-tourism-visa',
  },
  {
    source: '/visa/th/thailand-tourist-visa',
    destination: '/visa/th/thailand-tourism-visa',
  },
];
