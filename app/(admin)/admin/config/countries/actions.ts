'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { countries } from '@/lib/db/schema-extended';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import {
  countryMetadataSchema,
  type CountryMetadata,
  createCountrySchema,
} from '@/lib/validations/config';
import { generatePresignedUploadUrl, getPublicS3Url, type S3Folder } from '@/lib/s3';

/**
 * Server actions for country management
 * All actions require admin role
 */

/**
 * Create a new destination country
 */
export async function createCountry(data: unknown) {
  await requireRole(['admin']);

  try {
    const validated = createCountrySchema.parse(data);

    const existing = await db.query.countries.findFirst({
      where: eq(countries.iso2Code, validated.iso2Code),
      columns: { id: true },
    });

    if (existing) {
      return { error: `A country with ISO2 code ${validated.iso2Code} already exists` };
    }

    await db.insert(countries).values({
      name: validated.name,
      iso2Code: validated.iso2Code,
      enabled: validated.enabled,
      supported: validated.supported,
    });

    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${validated.iso2Code}`);
    revalidatePath('/admin/config/visa-listings');

    return {
      success: true,
      iso2Code: validated.iso2Code,
      message: 'Country created successfully',
    };
  } catch (error) {
    console.error('Error creating country:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid country data provided' };
    }

    return { error: 'Failed to create country' };
  }
}

/**
 * Toggle country enabled/disabled status
 */
export async function toggleCountryEnabled(countryId: string) {
  // Require admin role
  await requireRole(['admin']);

  try {
    // Get current country
    const country = await db.query.countries.findFirst({
      where: eq(countries.id, countryId)
    });

    if (!country) {
      return { error: 'Country not found' };
    }

    // Toggle enabled status
    await db
      .update(countries)
      .set({ enabled: !country.enabled, updatedAt: new Date() })
      .where(eq(countries.id, countryId));

    // Revalidate pages
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${country.iso2Code}`);

    return {
      success: true,
      enabled: !country.enabled,
      message: `Country ${!country.enabled ? 'enabled' : 'disabled'} successfully`
    };
  } catch (error) {
    console.error('Error toggling country:', error);
    return { error: 'Failed to toggle country status' };
  }
}

/**
 * Update country metadata (hero image, SEO, etc.)
 */
export async function updateCountryMetadata(countryId: string, data: CountryMetadata) {
  // Require admin role
  await requireRole(['admin']);

  try {
    // Validate input
    const validated = countryMetadataSchema.parse(data);

    // Check if country exists
    const country = await db.query.countries.findFirst({
      where: eq(countries.id, countryId)
    });

    if (!country) {
      return { error: 'Country not found' };
    }

    // Update country
    await db
      .update(countries)
      .set({
        ...validated,
        updatedAt: new Date()
      })
      .where(eq(countries.id, countryId));

    // Revalidate pages
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${country.iso2Code}`);

    return {
      success: true,
      message: 'Country updated successfully'
    };
  } catch (error) {
    console.error('Error updating country:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid country data provided' };
    }

    return { error: 'Failed to update country' };
  }
}

/**
 * Get country details for editing
 */
export async function getCountryForEdit(iso2Code: string) {
  await requireRole(['admin', 'reviewer']);

  try {
    const country = await db.query.countries.findFirst({
      where: eq(countries.iso2Code, iso2Code)
    });

    if (!country) {
      return { error: 'Country not found' };
    }

    return { success: true, country };
  } catch (error) {
    console.error('Error fetching country:', error);
    return { error: 'Failed to fetch country details' };
  }
}

/**
 * Generate presigned URL for country image upload
 */
export async function generateCountryImageUploadUrl(
  filename: string,
  fileType: string,
  folder: S3Folder
) {
  await requireRole(['admin']);

  try {
    const { url, key } = await generatePresignedUploadUrl(filename, fileType, folder);
    const publicUrl = getPublicS3Url(key);

    return {
      success: true,
      uploadUrl: url,
      publicUrl,
      key
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return { error: 'Failed to generate upload URL' };
  }
}

/**
 * Update country image (banner, hero, or flag)
 */
export async function updateCountryImage(
  countryId: string,
  imageType: 'banner' | 'hero' | 'flag',
  imageUrl: string,
  altText?: string,
  dimensions?: { width?: number; height?: number }
) {
  await requireRole(['admin']);

  try {
    const country = await db.query.countries.findFirst({
      where: eq(countries.id, countryId)
    });

    if (!country) {
      return { error: 'Country not found' };
    }

    // Prepare update data based on image type
    let updateData: any = { updatedAt: new Date() };

    if (imageType === 'banner') {
      updateData.bannerImageUrl = imageUrl;
      if (altText) updateData.bannerImageAlt = altText;
      if (dimensions?.width) updateData.bannerImageWidth = dimensions.width;
      if (dimensions?.height) updateData.bannerImageHeight = dimensions.height;
    } else if (imageType === 'hero') {
      updateData.heroImageUrl = imageUrl;
      if (altText) updateData.heroImageAlt = altText;
      if (dimensions?.width) updateData.heroImageWidth = dimensions.width;
      if (dimensions?.height) updateData.heroImageHeight = dimensions.height;
    } else if (imageType === 'flag') {
      updateData.flagLogoUrl = imageUrl;
    }

    // Update country
    await db
      .update(countries)
      .set(updateData)
      .where(eq(countries.id, countryId));

    // Revalidate pages
    revalidatePath('/admin/config/countries');
    revalidatePath(`/admin/config/countries/${country.iso2Code}`);

    return {
      success: true,
      message: `${imageType} image updated successfully`
    };
  } catch (error) {
    console.error('Error updating country image:', error);
    return { error: 'Failed to update image' };
  }
}
