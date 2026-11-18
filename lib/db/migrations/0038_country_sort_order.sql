ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;-->statement-breakpoint
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY name) - 1)::integer AS rank
  FROM countries
)
UPDATE countries
SET sort_order = ranked.rank
FROM ranked
WHERE countries.id = ranked.id;
