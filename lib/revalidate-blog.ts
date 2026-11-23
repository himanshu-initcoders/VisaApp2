import { revalidatePath } from 'next/cache';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { visaListings } from '@/lib/db/schema-extended';

function normalizeCountryCodes(codes: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes ?? []) {
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** Revalidate visa listing pages that may show related blogs for these countries. */
async function revalidateVisaListingsForCountries(countryCodes: string[]) {
  const codes = normalizeCountryCodes(countryCodes);
  if (codes.length === 0) return;

  try {
    const listings = await db
      .select({
        id: visaListings.id,
        slug: visaListings.slug,
        destinationCountry: visaListings.destinationCountry,
      })
      .from(visaListings)
      .where(inArray(visaListings.destinationCountry, codes));

    for (const listing of listings) {
      const country = listing.destinationCountry.toLowerCase();
      const segments = [listing.slug, listing.id].filter(Boolean);
      for (const segment of segments) {
        try {
          revalidatePath(`/visa/${country}/${segment}`);
        } catch (err) {
          console.warn(
            `revalidatePath error for /visa/${country}/${segment}:`,
            err
          );
        }
      }
    }
  } catch (err) {
    console.warn('Failed to revalidate visa listings for blog countries:', err);
  }
}

/** Invalidate public blog index and optional post after admin publish/edit. */
export async function revalidateBlog(options?: {
  slug?: string;
  previousSlug?: string;
  /** ISO2 codes attached to the post (and previously attached, on update). */
  countryCodes?: string[];
}) {
  revalidatePath('/blogs');
  revalidatePath('/blogs/[slug]', 'page');
  revalidatePath('/sitemap.xml');

  if (options?.slug) {
    revalidatePath(`/blogs/${options.slug}`);
  }
  if (options?.previousSlug && options.previousSlug !== options.slug) {
    revalidatePath(`/blogs/${options.previousSlug}`);
  }

  if (options?.countryCodes?.length) {
    await revalidateVisaListingsForCountries(options.countryCodes);
  }
}
