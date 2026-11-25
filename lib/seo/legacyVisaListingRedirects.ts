/**
 * Retired / renamed public visa listing paths → current canonical paths.
 * Used by next.config redirects (301) so indexed Google URLs do not 404.
 *
 * Destinations must match live lowercase `visa_listings.slug` values.
 * Sources keep historical Title-Case / typo paths Google already indexed.
 */
export const LEGACY_VISA_LISTING_REDIRECTS: ReadonlyArray<{
  source: string;
  destination: string;
}> = [
  // Australia — Arrival Card / misspelled Arrivel removed; send to Tourist
  {
    source: '/visa/au/Australia-Visa-On-Arrivel',
    destination: '/visa/au/australia-tourism-visa',
  },
  {
    source: '/visa/au/australia-visa-on-arrivel',
    destination: '/visa/au/australia-tourism-visa',
  },
  {
    source: '/visa/au/Australia-Arrival-Card',
    destination: '/visa/au/australia-tourism-visa',
  },
  {
    source: '/visa/au/australia-arrival-card',
    destination: '/visa/au/australia-tourism-visa',
  },
  // Australia — retired Sub-Class / Business-100 listings → remaining Business
  {
    source: '/visa/au/Australia-Sub-Class-1000',
    destination: '/visa/au/australia-business-visa',
  },
  {
    source: '/visa/au/australia-sub-class-1000',
    destination: '/visa/au/australia-business-visa',
  },
  {
    source: '/visa/au/Australia-Business-Visa-100',
    destination: '/visa/au/australia-business-visa',
  },
  {
    source: '/visa/au/australia-business-visa-100',
    destination: '/visa/au/australia-business-visa',
  },
  // Thailand — Business removed; Tourism slug renamed to Tourist
  {
    source: '/visa/th/Thailand-Business-Visa',
    destination: '/visa/th/thailand-tourist-visa',
  },
  {
    source: '/visa/th/thailand-business-visa',
    destination: '/visa/th/thailand-tourist-visa',
  },
  {
    source: '/visa/th/Thailand-Tourism-Visa',
    destination: '/visa/th/thailand-tourist-visa',
  },
  {
    source: '/visa/th/thailand-tourism-visa',
    destination: '/visa/th/thailand-tourist-visa',
  },
];
