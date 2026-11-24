-- Visa Form Builder steps (passport-style) + system field binding on questions

DO $$ BEGIN
  CREATE TYPE "public"."visa_form_step_kind" AS ENUM('ocr', 'trip', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "visa_form_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "visa_listing_id" uuid NOT NULL REFERENCES "visa_listings"("id") ON DELETE cascade,
  "title" varchar(120) NOT NULL,
  "description" text,
  "kind" "visa_form_step_kind" DEFAULT 'custom' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "visa_form_steps_visa_listing_id_idx"
  ON "visa_form_steps" ("visa_listing_id");

ALTER TABLE "additional_questions"
  ADD COLUMN IF NOT EXISTS "step_id" uuid
    REFERENCES "visa_form_steps"("id") ON DELETE cascade;

ALTER TABLE "additional_questions"
  ADD COLUMN IF NOT EXISTS "system_key" varchar(50);

-- category becomes optional (legacy); keep existing values
ALTER TABLE "additional_questions"
  ALTER COLUMN "category" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "additional_questions_step_id_idx"
  ON "additional_questions" ("step_id");

-- ---------------------------------------------------------------------------
-- Backfill: seed OCR + Trip steps and migrate existing questions by category
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  listing RECORD;
  ocr_step_id uuid;
  trip_step_id uuid;
  custom_step_id uuid;
  cat RECORD;
  sort_base integer;
BEGIN
  FOR listing IN SELECT id FROM visa_listings LOOP
    -- Skip if already seeded
    IF EXISTS (
      SELECT 1 FROM visa_form_steps
      WHERE visa_listing_id = listing.id AND kind = 'ocr'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO visa_form_steps (id, visa_listing_id, title, description, kind, sort_order)
    VALUES (
      gen_random_uuid(), listing.id, 'Personal details',
      'Passport biodata filled from OCR or entered manually.',
      'ocr', 0
    )
    RETURNING id INTO ocr_step_id;

    INSERT INTO visa_form_steps (id, visa_listing_id, title, description, kind, sort_order)
    VALUES (
      gen_random_uuid(), listing.id, 'Trip details',
      'Arrival, return, and accommodation for this traveller.',
      'trip', 1
    )
    RETURNING id INTO trip_step_id;

    -- OCR system questions
    INSERT INTO additional_questions (
      visa_listing_id, step_id, key, system_key, label, question_type, category, required, sort_order, options
    ) VALUES
      (listing.id, ocr_step_id, 'sys.givenNames', 'givenNames', 'First name', 'text', 'passenger_details', true, 0, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.surname', 'surname', 'Last name', 'text', 'passenger_details', true, 1, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.fathersName', 'fathersName', 'Father''s name', 'text', 'passenger_details', false, 2, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.mothersName', 'mothersName', 'Mother''s name', 'text', 'passenger_details', false, 3, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.sex', 'sex', 'Gender', 'dropdown', 'passenger_details', true, 4,
        '[{"label":"Male","value":"M"},{"label":"Female","value":"F"},{"label":"Other","value":"X"}]'::jsonb),
      (listing.id, ocr_step_id, 'sys.dateOfBirth', 'dateOfBirth', 'Date of birth', 'date', 'passenger_details', true, 5, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.placeOfBirth', 'placeOfBirth', 'Place of birth', 'text', 'passenger_details', false, 6, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.nationality', 'nationality', 'Nationality', 'text', 'passenger_details', false, 7, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.spouseName', 'spouseName', 'Spouse''s name', 'text', 'passenger_details', false, 8, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.passportNumber', 'passportNumber', 'Passport number', 'text', 'passenger_details', true, 9, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.dateOfIssue', 'dateOfIssue', 'Issued on', 'date', 'passenger_details', false, 10, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.dateOfExpiry', 'dateOfExpiry', 'Valid till', 'date', 'passenger_details', true, 11, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.placeOfIssue', 'placeOfIssue', 'Place of issue', 'text', 'passenger_details', false, 12, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.countryOfIssue', 'countryOfIssue', 'Country of issue', 'text', 'passenger_details', false, 13, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.address', 'address', 'Address', 'text', 'passenger_details', false, 14, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.email', 'email', 'Email', 'text', 'passenger_details', true, 15, '[]'::jsonb),
      (listing.id, ocr_step_id, 'sys.phone', 'phone', 'Phone', 'text', 'passenger_details', true, 16, '[]'::jsonb);

    -- Trip system questions
    INSERT INTO additional_questions (
      visa_listing_id, step_id, key, system_key, label, question_type, category, required, sort_order, options
    ) VALUES
      (listing.id, trip_step_id, 'sys.flightNumber', 'flightNumber', 'Arrival flight number', 'text', 'travel_details', true, 0, '[]'::jsonb),
      (listing.id, trip_step_id, 'sys.arrivalFlightDate', 'arrivalFlightDate', 'Arrival date', 'date', 'travel_details', true, 1, '[]'::jsonb),
      (listing.id, trip_step_id, 'sys.returnFlightNumber', 'returnFlightNumber', 'Return flight number', 'text', 'travel_details', true, 2, '[]'::jsonb),
      (listing.id, trip_step_id, 'sys.returnFlightDate', 'returnFlightDate', 'Return departure date', 'date', 'travel_details', true, 3, '[]'::jsonb),
      (listing.id, trip_step_id, 'sys.arrivalCity', 'arrivalCity', 'Arrival city', 'text', 'travel_details', false, 4, '[]'::jsonb),
      (listing.id, trip_step_id, 'sys.accommodationName', 'accommodationName', 'Hotel / accommodation name', 'text', 'travel_details', false, 5, '[]'::jsonb),
      (listing.id, trip_step_id, 'sys.accommodationAddress', 'accommodationAddress', 'Accommodation address', 'text', 'travel_details', false, 6, '[]'::jsonb);

    -- Move pre-existing (non-system) questions into custom steps by category
    sort_base := 2;
    FOR cat IN
      SELECT DISTINCT COALESCE(category, 'other') AS category
      FROM additional_questions
      WHERE visa_listing_id = listing.id
        AND step_id IS NULL
        AND system_key IS NULL
      ORDER BY 1
    LOOP
      INSERT INTO visa_form_steps (id, visa_listing_id, title, kind, sort_order)
      VALUES (
        gen_random_uuid(),
        listing.id,
        CASE cat.category
          WHEN 'passenger_details' THEN 'Passenger details'
          WHEN 'travel_details' THEN 'Travel details'
          WHEN 'financial_information' THEN 'Financial information'
          WHEN 'employment_education' THEN 'Employment & education'
          WHEN 'family_details' THEN 'Family details'
          WHEN 'accommodation' THEN 'Accommodation'
          ELSE 'Other'
        END,
        'custom',
        sort_base
      )
      RETURNING id INTO custom_step_id;

      UPDATE additional_questions
      SET step_id = custom_step_id
      WHERE visa_listing_id = listing.id
        AND step_id IS NULL
        AND system_key IS NULL
        AND COALESCE(category, 'other') = cat.category;

      sort_base := sort_base + 1;
    END LOOP;
  END LOOP;
END $$;
