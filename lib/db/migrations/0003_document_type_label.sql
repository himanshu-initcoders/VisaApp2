-- Add document type + display label for UUID-keyed document requirements
ALTER TABLE "components_required" ADD COLUMN IF NOT EXISTS "document_type" varchar(80);
ALTER TABLE "components_required" ADD COLUMN IF NOT EXISTS "label" text;

-- Backfill from legacy slug keys where possible
UPDATE "components_required"
SET "document_type" = "key"
WHERE "document_type" IS NULL
  AND "key" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "components_required"
SET "label" = initcap(replace(coalesce("document_type", "key"), '_', ' '))
WHERE "label" IS NULL;
