import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { visaListings } from '@/lib/db/schema-extended';
import { eq } from 'drizzle-orm';
import { scheduleWarmPublicVisaCatalog } from '@/lib/warm-public-catalog';
import {
  PUBLIC_PASSPORT_CATALOG_TAG,
  PUBLIC_VISA_CATALOG_TAG,
} from '@/lib/public-catalog-tags';

export { PUBLIC_PASSPORT_CATALOG_TAG, PUBLIC_VISA_CATALOG_TAG };

/**
 * Invalidate public catalog pages after admin country / visa-listing changes.
 * Without this, Vercel can keep serving a stale empty homepage or outdated hero images.
 * After purge, schedule a background warm so listing HTML + hero images are ready
 * before the next visitor hits a cold /_next/image miss.
 */
export async function revalidatePublicVisaCatalog(options?: {
  countryCode?: string;
  listingId?: string;
  listingSlug?: string;
  previousSlug?: string;
  /** Set false when a caller will warm explicitly (e.g. deploy script). */
  warm?: boolean;
}) {
  try {
    revalidateTag(PUBLIC_VISA_CATALOG_TAG, 'max');
  } catch (err) {
    console.warn('revalidateTag error:', err);
  }

  try {
    revalidatePath('/');
    revalidatePath('/destinations');
    revalidatePath('/visa');
  } catch (err) {
    console.warn('revalidatePath catalog routes error:', err);
  }

  const countryCode = options?.countryCode?.toLowerCase();
  const segments = new Set(
    [
      options?.listingId,
      options?.listingSlug,
      options?.previousSlug,
    ].filter((segment): segment is string => Boolean(segment))
  );

  if (countryCode) {
    try {
      // Find all listings for this country so every visa process detail page
      // is revalidated when country hero/banner images or details change.
      const listings = await db
        .select({ id: visaListings.id, slug: visaListings.slug })
        .from(visaListings)
        .where(eq(visaListings.destinationCountry, countryCode.toUpperCase()));

      for (const listing of listings) {
        if (listing.slug) segments.add(listing.slug);
        if (listing.id) segments.add(listing.id);
      }
    } catch (err) {
      console.warn('Failed to query visa listings for revalidation:', err);
    }

    for (const segment of segments) {
      try {
        revalidatePath(`/visa/${countryCode}/${segment}`);
        revalidatePath(`/visa/${countryCode}/${segment}/apply`);
      } catch (err) {
        console.warn(`revalidatePath error for /visa/${countryCode}/${segment}:`, err);
      }
    }

    try {
      revalidatePath(`/visa/${countryCode}`);
    } catch (err) {
      console.warn(`revalidatePath error for /visa/${countryCode}:`, err);
    }
  }

  // Refresh dynamic route patterns
  try {
    revalidatePath('/visa/[countryCode]/[listingId]', 'page');
    revalidatePath('/visa/[countryCode]/[listingId]/apply', 'page');
  } catch (err) {
    console.warn('revalidatePath pattern error:', err);
  }

  if (options?.warm !== false) {
    scheduleWarmPublicVisaCatalog(
      countryCode ? { countryCode } : undefined
    );
  }
}

/**
 * Invalidate public passport pages after admin passport-listing changes.
 */
export function revalidatePublicPassportCatalog(options?: {
  serviceType?: string;
}) {
  try {
    revalidateTag(PUBLIC_PASSPORT_CATALOG_TAG, 'max');
  } catch (err) {
    console.warn('revalidateTag passport error:', err);
  }
  revalidatePath('/passport');
  revalidatePath('/');

  const serviceType = options?.serviceType;
  if (serviceType) {
    revalidatePath(`/passport/${serviceType}/apply`);
  }
  revalidatePath('/passport/[serviceType]/apply', 'page');
}
