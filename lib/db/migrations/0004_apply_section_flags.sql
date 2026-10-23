-- Apply form section visibility toggles
ALTER TABLE "visa_listings" ADD COLUMN IF NOT EXISTS "show_general_info" boolean DEFAULT true NOT NULL;
ALTER TABLE "visa_listings" ADD COLUMN IF NOT EXISTS "show_trip_details" boolean DEFAULT true NOT NULL;
