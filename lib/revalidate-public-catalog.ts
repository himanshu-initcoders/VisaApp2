import { revalidatePath, revalidateTag } from 'next/cache';

/** Shared cache tag for public landing / destinations / listing queries. */
export const PUBLIC_VISA_CATALOG_TAG = 'public-visa-catalog';

/**
 * Invalidate public catalog pages after admin country / visa-listing changes.
 * Without this, Vercel can keep serving a stale empty homepage.
 */
export function revalidatePublicVisaCatalog(options?: {
  countryCode?: string;
  listingId?: string;
  listingSlug?: string;
  previousSlug?: string;
}) {
  revalidateTag(PUBLIC_VISA_CATALOG_TAG, 'max');
  revalidatePath('/');
  revalidatePath('/');

  const countryCode = options?.countryCode?.toLowerCase();
  const segments = [
    options?.listingId,
    options?.listingSlug,
    options?.previousSlug,
  ].filter((segment): segment is string => Boolean(segment));

  if (countryCode) {
    for (const segment of segments) {
      revalidatePath(`/visa/${countryCode}/${segment}`);
      revalidatePath(`/visa/${countryCode}/${segment}/apply`);
    }
  }

  // Refresh all process detail pages under /visa
  revalidatePath('/visa/[countryCode]/[listingId]', 'page');
  revalidatePath('/visa/[countryCode]/[listingId]/apply', 'page');
}

/** Shared cache tag for public passport marketing / apply queries. */
export const PUBLIC_PASSPORT_CATALOG_TAG = 'public-passport-catalog';

/**
 * Invalidate public passport pages after admin passport-listing changes.
 */
export function revalidatePublicPassportCatalog(options?: {
  serviceType?: string;
}) {
  revalidateTag(PUBLIC_PASSPORT_CATALOG_TAG, 'max');
  revalidatePath('/passport');
  revalidatePath('/');

  const serviceType = options?.serviceType;
  if (serviceType) {
    revalidatePath(`/passport/${serviceType}/apply`);
  }
  revalidatePath('/passport/[serviceType]/apply', 'page');
}
