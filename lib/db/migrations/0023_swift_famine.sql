ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "reference_number" varchar(14);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visa_applications_reference_number_unique" ON "visa_applications" USING btree ("reference_number");--> statement-breakpoint
DO $$
DECLARE
  r RECORD;
  candidate text;
  attempts int;
BEGIN
  FOR r IN
    SELECT id FROM visa_applications WHERE reference_number IS NULL
  LOOP
    attempts := 0;
    LOOP
      attempts := attempts + 1;
      candidate := 'VI' || lpad((floor(random() * 1000000000000))::bigint::text, 12, '0');
      IF NOT EXISTS (
        SELECT 1 FROM visa_applications WHERE reference_number = candidate
      ) THEN
        UPDATE visa_applications
        SET reference_number = candidate
        WHERE id = r.id;
        EXIT;
      END IF;
      IF attempts >= 20 THEN
        RAISE EXCEPTION 'Failed to allocate unique reference_number for %', r.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "visa_applications" ALTER COLUMN "reference_number" SET NOT NULL;
