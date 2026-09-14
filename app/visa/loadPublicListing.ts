'use server';

import { z } from 'zod';
import { getPublicProcessPageData } from '@/lib/db/queries/public';

const loadPublicListingSchema = z.object({
  countryCode: z.string().trim().regex(/^[a-zA-Z]{2}$/),
  listingId: z.string().uuid(),
});

export async function loadPublicListingPage(input: {
  countryCode: string;
  listingId: string;
}) {
  const parsed = loadPublicListingSchema.safeParse(input);
  if (!parsed.success) return null;

  return getPublicProcessPageData(
    parsed.data.countryCode,
    parsed.data.listingId
  );
}
