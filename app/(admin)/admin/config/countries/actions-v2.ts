'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { countries } from '@/lib/db/schema-extended';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';

/**
 * Server actions for country management with JSON structure
 */

interface CountryImages {
  banner?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  hero?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  flag?: {
    url: string;
  };
}

interface CountrySEO {
  metaTitle?: string;
  metaDescription?: string;
  headline?: string;
}

interface UpdateCountryData {
  images?: CountryImages;
  seo?: CountrySEO;
  name?: string;
  enabled?: boolean;
  showAuthorizationTag?: boolean;
}

/**
 * Update country with JSON structure
 */
export async function updateCountryV2(
  countryId: string,
  data: UpdateCountryData
) {
  await requireRole(['admin']);

  try {
    // Get current country
    const country = await db.query.countries.findFirst({
      where: eq(countries.id, countryId),
    });

    if (!country) {
      return { success: false, error: 'Country not found' };
    }

    // Update country
    await db
      .update(countries)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(countries.id, countryId));

    // Revalidate pages
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${country.iso2Code}`);
    revalidatePath(`/admin/config/visa-listings?country=${country.iso2Code}`);

    return {
      success: true,
      message: 'Country updated successfully',
    };
  } catch (error) {
    console.error('Error updating country:', error);
    return { success: false, error: 'Failed to update country' };
  }
}

/**
 * Update country by ISO code
 */
export async function updateCountryByIsoCode(
  iso2Code: string,
  data: UpdateCountryData
) {
  await requireRole(['admin']);

  try {
    // Get current country
    const country = await db.query.countries.findFirst({
      where: eq(countries.iso2Code, iso2Code.toUpperCase()),
    });

    if (!country) {
      return { success: false, error: 'Country not found' };
    }

    // Update country
    await db
      .update(countries)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(countries.id, country.id));

    // Revalidate pages
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${country.iso2Code}`);
    revalidatePath(`/admin/config/visa-listings?country=${country.iso2Code}`);

    return {
      success: true,
      message: 'Country updated successfully',
    };
  } catch (error) {
    console.error('Error updating country:', error);
    return { success: false, error: 'Failed to update country' };
  }
}
