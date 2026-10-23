-- Link application_drafts.listing_id to visa_listings with cascade delete.
-- Drop orphan drafts that point at missing listings first.
DELETE FROM "application_drafts" d
WHERE NOT EXISTS (
  SELECT 1 FROM "visa_listings" v WHERE v.id = d.listing_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'application_drafts_listing_id_visa_listings_id_fk'
  ) THEN
    ALTER TABLE "application_drafts"
      ADD CONSTRAINT "application_drafts_listing_id_visa_listings_id_fk"
      FOREIGN KEY ("listing_id")
      REFERENCES "visa_listings"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
