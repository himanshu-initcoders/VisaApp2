-- Public SEO slug for each visa listing (e.g. Japan-Tourism-Visa).
ALTER TABLE "visa_listings" ADD COLUMN IF NOT EXISTS "slug" varchar(120);

WITH base AS (
  SELECT
    vl.id,
    left(
      trim(both '-' from regexp_replace(
        initcap(c.name) || '-' || initcap(replace(vl.purpose::text, '_', ' ')) || '-Visa',
        '[^A-Za-z0-9]+',
        '-',
        'g'
      )),
      100
    ) AS base_slug,
    row_number() OVER (
      PARTITION BY
        vl.destination_country,
        lower(left(
          trim(both '-' from regexp_replace(
            initcap(c.name) || '-' || initcap(replace(vl.purpose::text, '_', ' ')) || '-Visa',
            '[^A-Za-z0-9]+',
            '-',
            'g'
          )),
          100
        ))
      ORDER BY vl.created_at, vl.id
    ) AS rn
  FROM visa_listings vl
  INNER JOIN countries c ON c.iso2_code = vl.destination_country
  WHERE vl.slug IS NULL
)
UPDATE visa_listings vl
SET slug = CASE
  WHEN b.rn = 1 THEN b.base_slug
  ELSE b.base_slug || '-' || b.rn::text
END
FROM base b
WHERE vl.id = b.id;

UPDATE visa_listings
SET slug = 'Visa-' || substr(replace(id::text, '-', ''), 1, 8)
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE visa_listings ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS visa_listings_country_slug_unique
  ON visa_listings (destination_country, slug);
