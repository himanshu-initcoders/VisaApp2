/**
 * Retired / renamed public visa listing paths → current canonical paths.
 * Used by next.config redirects (301) so indexed Google URLs do not 404.
 *
 * Keep destination paths aligned with live `visa_listings.slug` values.
 */
export const LEGACY_VISA_LISTING_REDIRECTS: ReadonlyArray<{
  source: string;
  destination: string;
}> = [
  // Australia — Arrival Card / misspelled Arrivel removed; send to Tourist
  {
    source: '/visa/au/Australia-Visa-On-Arrivel',
    destination: '/visa/au/Australia-Tourism-Visa',
  },
  {
    source: '/visa/au/Australia-Arrival-Card',
    destination: '/visa/au/Australia-Tourism-Visa',
  },
  // Australia — retired Sub-Class / Business-100 listings → remaining Business
  {
    source: '/visa/au/Australia-Sub-Class-1000',
    destination: '/visa/au/Australia-Business-Visa',
  },
  {
    source: '/visa/au/Australia-Business-Visa-100',
    destination: '/visa/au/Australia-Business-Visa',
  },
  // Thailand — Business removed; Tourism slug renamed to Tourist
  {
    source: '/visa/th/Thailand-Business-Visa',
    destination: '/visa/th/Thailand-Tourist-Visa',
  },
  {
    source: '/visa/th/Thailand-Tourism-Visa',
    destination: '/visa/th/Thailand-Tourist-Visa',
  },
];
