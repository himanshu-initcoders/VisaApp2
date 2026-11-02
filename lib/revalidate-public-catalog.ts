import { revalidatePath } from 'next/cache';

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
  revalidatePath('/');
  revalidatePath('/destinations');

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
