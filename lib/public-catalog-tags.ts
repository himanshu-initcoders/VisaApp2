/**
 * Leaf cache-tag constants (no imports) so public query modules can use them
 * without circular init with revalidate → warm → public.
 */

/** Shared cache tag for public landing / destinations / listing queries. */
export const PUBLIC_VISA_CATALOG_TAG = 'public-visa-catalog';

/** Shared cache tag for public passport marketing / apply queries. */
export const PUBLIC_PASSPORT_CATALOG_TAG = 'public-passport-catalog';
