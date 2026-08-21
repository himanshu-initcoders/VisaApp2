-- ============================================================================
-- MIGRATION: Restructure Countries Table to JSON Fields
-- ============================================================================
-- This migration consolidates image and SEO fields into JSON columns
-- for better organization and flexibility.
--
-- WHAT IT DOES:
-- 1. Adds new 'images' and 'seo' JSONB columns
-- 2. Migrates all existing data to JSON format
-- 3. Removes old separate columns
-- 4. No data loss - all existing data is preserved
--
-- HOW TO RUN:
-- Copy and paste this entire SQL into your PostgreSQL client (pgAdmin, DBeaver, etc.)
-- and execute it.
-- ============================================================================

-- Step 1: Add new JSON columns
ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "images" jsonb;
ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "seo" jsonb;

-- Step 2: Migrate images data to JSON format
UPDATE "countries"
SET images = jsonb_build_object(
  'banner', CASE
    WHEN banner_image_url IS NOT NULL THEN jsonb_build_object(
      'url', banner_image_url,
      'alt', banner_image_alt,
      'width', banner_image_width,
      'height', banner_image_height
    )
    ELSE NULL
  END,
  'hero', CASE
    WHEN hero_image_url IS NOT NULL THEN jsonb_build_object(
      'url', hero_image_url,
      'alt', hero_image_alt,
      'width', hero_image_width,
      'height', hero_image_height
    )
    ELSE NULL
  END,
  'flag', CASE
    WHEN flag_logo_url IS NOT NULL THEN jsonb_build_object(
      'url', flag_logo_url
    )
    ELSE NULL
  END
)
WHERE banner_image_url IS NOT NULL
   OR hero_image_url IS NOT NULL
   OR flag_logo_url IS NOT NULL;

-- Step 3: Migrate SEO data to JSON format
UPDATE "countries"
SET seo = jsonb_build_object(
  'metaTitle', meta_title,
  'metaDescription', meta_description,
  'headline', headline
)
WHERE meta_title IS NOT NULL
   OR meta_description IS NOT NULL
   OR headline IS NOT NULL;

-- Step 4: Verify migration (run this to see results)
SELECT
  id,
  name,
  iso2_code,
  CASE WHEN images IS NOT NULL THEN 'Migrated ✅' ELSE 'No images' END as images_status,
  CASE WHEN seo IS NOT NULL THEN 'Migrated ✅' ELSE 'No SEO' END as seo_status
FROM countries
LIMIT 5;

-- Step 5: Drop old columns (ONLY run this after verifying Step 4 looks good!)
-- IMPORTANT: Once you drop these columns, you cannot get the data back unless you have a backup!
-- Make sure Step 4 shows "Migrated ✅" for countries that had images/SEO before proceeding.

ALTER TABLE "countries" DROP COLUMN IF EXISTS "banner_image_url";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "banner_image_alt";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "banner_image_width";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "banner_image_height";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "hero_image_url";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "hero_image_alt";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "hero_image_width";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "hero_image_height";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "flag_logo_url";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "meta_title";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "meta_description";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "headline";

-- Step 6: Final verification
SELECT
  column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'nullable' ELSE 'not null' END as nullable
FROM information_schema.columns
WHERE table_name = 'countries'
  AND column_name IN ('images', 'seo')
ORDER BY column_name;

-- Expected result:
-- column_name | data_type | nullable
-- ------------+-----------+----------
-- images      | jsonb     | nullable
-- seo         | jsonb     | nullable

-- Done! Now you can use the new JSON structure in your app.
