import { revalidatePath } from 'next/cache';

/**
 * Invalidate public catalog pages after admin country / visa-listing changes.
 * Without this, Vercel can keep serving a stale empty homepage.
 */
export function revalidatePublicVisaCatalog(options?: {
  countryCode?: string;
  listingId?: string;
}) {
  revalidatePath('/');
  revalidatePath('/destinations');

  const countryCode = options?.countryCode?.toUpperCase();
  const listingId = options?.listingId;

  if (countryCode && listingId) {
    revalidatePath(`/visa/${countryCode}/${listingId}`);
    revalidatePath(`/visa/${countryCode}/${listingId}/apply`);
  }

  // Refresh all process detail pages under /visa
  revalidatePath('/visa/[countryCode]/[listingId]', 'page');
  revalidatePath('/visa/[countryCode]/[listingId]/apply', 'page');
}
