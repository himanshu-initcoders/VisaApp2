-- Rename passenger_* leftovers to traveller_* naming (idempotent for prod/local).
-- form_traveller_id = client/form slot id (matches travellers JSON + S3 path).
-- NOT traveler_profiles.id and NOT visa_application_travellers.id (UUID PKs).
-- Plain traveller_id stays reserved as FK → visa_application_travellers.id.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visa_application_travellers'
      AND column_name = 'passenger_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visa_application_travellers'
      AND column_name = 'form_traveller_id'
  ) THEN
    ALTER TABLE "visa_application_travellers"
      RENAME COLUMN "passenger_id" TO "form_traveller_id";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'visa_application_travellers_app_passenger_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'visa_application_travellers_app_form_traveller_unique'
  ) THEN
    ALTER INDEX "visa_application_travellers_app_passenger_unique"
      RENAME TO "visa_application_travellers_app_form_traveller_unique";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visa_applications'
      AND column_name = 'passenger_names'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'visa_applications'
      AND column_name = 'traveller_names'
  ) THEN
    ALTER TABLE "visa_applications"
      RENAME COLUMN "passenger_names" TO "traveller_names";
  END IF;
END $$;
