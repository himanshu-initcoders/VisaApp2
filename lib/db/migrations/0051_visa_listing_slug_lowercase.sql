-- Canonical public listing slugs are lowercase (australia-tourism-visa).
-- Safe: uniqueness is per (destination_country, slug); no collisions on lower().

UPDATE visa_listings
SET
  slug = lower(slug),
  updated_at = now()
WHERE slug <> lower(slug);
