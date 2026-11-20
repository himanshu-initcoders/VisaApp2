-- Shared question catalog for cross-listing autofill identity.
-- Category / required / visibility stay on listing rows.
-- Historical form_snapshot / answer JSON is NOT rewritten.

CREATE TABLE IF NOT EXISTS "question_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(50) NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "question_type" "question_type" NOT NULL,
  "options" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "question_catalog_key_unique" ON "question_catalog" USING btree ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_catalog_label_idx" ON "question_catalog" USING btree ("label");
--> statement-breakpoint

ALTER TABLE "additional_questions"
  ADD COLUMN IF NOT EXISTS "catalog_question_id" uuid;
--> statement-breakpoint
ALTER TABLE "passport_additional_questions"
  ADD COLUMN IF NOT EXISTS "catalog_question_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "additional_questions"
    ADD CONSTRAINT "additional_questions_catalog_question_id_question_catalog_id_fk"
    FOREIGN KEY ("catalog_question_id") REFERENCES "public"."question_catalog"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "passport_additional_questions"
    ADD CONSTRAINT "passport_additional_questions_catalog_question_id_question_catalog_id_fk"
    FOREIGN KEY ("catalog_question_id") REFERENCES "public"."question_catalog"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Backfill: merge by normalized label + question_type across visa + passport.
-- Within a single listing, only the newest row of a group joins the shared catalog;
-- older duplicates get their own 1:1 catalog rows so unique(listing, key/catalog) holds.
DO $$
DECLARE
  r RECORD;
  catalog_id uuid;
  catalog_key varchar(50);
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _qc_group_map (
    grp text PRIMARY KEY,
    catalog_id uuid NOT NULL,
    catalog_key varchar(50) NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS _qc_key_remap (
    src text NOT NULL,
    listing_id uuid NOT NULL,
    question_id uuid NOT NULL,
    old_key varchar(50) NOT NULL,
    new_key varchar(50) NOT NULL
  ) ON COMMIT DROP;

  -- Shared catalog winners (most recent overall per label|type)
  FOR r IN
    SELECT DISTINCT ON (grp)
      id,
      label,
      description,
      question_type,
      options,
      key,
      grp
    FROM (
      SELECT
        aq.id,
        aq.label,
        aq.description,
        aq.question_type,
        aq.options,
        aq.key,
        aq.created_at,
        lower(trim(both FROM aq.label)) || '|' || aq.question_type::text AS grp
      FROM additional_questions aq
      WHERE aq.catalog_question_id IS NULL
      UNION ALL
      SELECT
        pq.id,
        pq.label,
        pq.description,
        pq.question_type,
        pq.options,
        pq.key,
        pq.created_at,
        lower(trim(both FROM pq.label)) || '|' || pq.question_type::text AS grp
      FROM passport_additional_questions pq
      WHERE pq.catalog_question_id IS NULL
    ) all_q
    ORDER BY grp, created_at DESC
  LOOP
    INSERT INTO question_catalog (id, key, label, description, question_type, options)
    VALUES (
      gen_random_uuid(),
      r.key,
      r.label,
      r.description,
      r.question_type,
      COALESCE(r.options, '[]'::jsonb)
    )
    ON CONFLICT (key) DO NOTHING;

    SELECT qc.id, qc.key INTO catalog_id, catalog_key
    FROM question_catalog qc
    WHERE qc.key = r.key
    LIMIT 1;

    IF catalog_id IS NULL THEN
      INSERT INTO question_catalog (id, key, label, description, question_type, options)
      VALUES (
        gen_random_uuid(),
        r.id::text,
        r.label,
        r.description,
        r.question_type,
        COALESCE(r.options, '[]'::jsonb)
      )
      RETURNING id, key INTO catalog_id, catalog_key;
    END IF;

    INSERT INTO _qc_group_map (grp, catalog_id, catalog_key)
    VALUES (r.grp, catalog_id, catalog_key)
    ON CONFLICT (grp) DO NOTHING;
  END LOOP;

  -- Visa: newest per (listing, grp) → shared catalog; older dupes → private catalog
  FOR r IN
    SELECT
      aq.id,
      aq.visa_listing_id AS listing_id,
      aq.key AS old_key,
      aq.label,
      aq.description,
      aq.question_type,
      aq.options,
      lower(trim(both FROM aq.label)) || '|' || aq.question_type::text AS grp,
      ROW_NUMBER() OVER (
        PARTITION BY aq.visa_listing_id, lower(trim(both FROM aq.label)), aq.question_type
        ORDER BY aq.created_at DESC
      ) AS rn_in_listing
    FROM additional_questions aq
    WHERE aq.catalog_question_id IS NULL
  LOOP
    IF r.rn_in_listing = 1 THEN
      SELECT m.catalog_id, m.catalog_key INTO catalog_id, catalog_key
      FROM _qc_group_map m
      WHERE m.grp = r.grp;

      IF catalog_id IS NULL THEN
        INSERT INTO question_catalog (id, key, label, description, question_type, options)
        VALUES (
          gen_random_uuid(),
          r.old_key,
          r.label,
          r.description,
          r.question_type,
          COALESCE(r.options, '[]'::jsonb)
        )
        ON CONFLICT (key) DO NOTHING;

        SELECT qc.id, qc.key INTO catalog_id, catalog_key
        FROM question_catalog qc
        WHERE qc.key = r.old_key
        LIMIT 1;
      END IF;
    ELSE
      INSERT INTO question_catalog (id, key, label, description, question_type, options)
      VALUES (
        gen_random_uuid(),
        r.old_key,
        r.label,
        r.description,
        r.question_type,
        COALESCE(r.options, '[]'::jsonb)
      )
      ON CONFLICT (key) DO NOTHING;

      SELECT qc.id, qc.key INTO catalog_id, catalog_key
      FROM question_catalog qc
      WHERE qc.key = r.old_key
      LIMIT 1;
    END IF;

    UPDATE additional_questions
    SET catalog_question_id = catalog_id,
        key = catalog_key
    WHERE id = r.id;

    INSERT INTO _qc_key_remap (src, listing_id, question_id, old_key, new_key)
    VALUES ('visa', r.listing_id, r.id, r.old_key, catalog_key);
  END LOOP;

  -- Passport: same rules
  FOR r IN
    SELECT
      pq.id,
      pq.passport_listing_id AS listing_id,
      pq.key AS old_key,
      pq.label,
      pq.description,
      pq.question_type,
      pq.options,
      lower(trim(both FROM pq.label)) || '|' || pq.question_type::text AS grp,
      ROW_NUMBER() OVER (
        PARTITION BY pq.passport_listing_id, lower(trim(both FROM pq.label)), pq.question_type
        ORDER BY pq.created_at DESC
      ) AS rn_in_listing
    FROM passport_additional_questions pq
    WHERE pq.catalog_question_id IS NULL
  LOOP
    IF r.rn_in_listing = 1 THEN
      SELECT m.catalog_id, m.catalog_key INTO catalog_id, catalog_key
      FROM _qc_group_map m
      WHERE m.grp = r.grp;

      IF catalog_id IS NULL THEN
        INSERT INTO question_catalog (id, key, label, description, question_type, options)
        VALUES (
          gen_random_uuid(),
          r.old_key,
          r.label,
          r.description,
          r.question_type,
          COALESCE(r.options, '[]'::jsonb)
        )
        ON CONFLICT (key) DO NOTHING;

        SELECT qc.id, qc.key INTO catalog_id, catalog_key
        FROM question_catalog qc
        WHERE qc.key = r.old_key
        LIMIT 1;
      END IF;
    ELSE
      INSERT INTO question_catalog (id, key, label, description, question_type, options)
      VALUES (
        gen_random_uuid(),
        r.old_key,
        r.label,
        r.description,
        r.question_type,
        COALESCE(r.options, '[]'::jsonb)
      )
      ON CONFLICT (key) DO NOTHING;

      SELECT qc.id, qc.key INTO catalog_id, catalog_key
      FROM question_catalog qc
      WHERE qc.key = r.old_key
      LIMIT 1;
    END IF;

    UPDATE passport_additional_questions
    SET catalog_question_id = catalog_id,
        key = catalog_key
    WHERE id = r.id;

    INSERT INTO _qc_key_remap (src, listing_id, question_id, old_key, new_key)
    VALUES ('passport', r.listing_id, r.id, r.old_key, catalog_key);
  END LOOP;

  -- Remap visibility.sourceQuestionKey when sibling keys changed
  UPDATE additional_questions aq
  SET visibility = jsonb_set(
    aq.visibility,
    '{sourceQuestionKey}',
    to_jsonb(rm.new_key)
  )
  FROM _qc_key_remap rm
  WHERE rm.src = 'visa'
    AND aq.visa_listing_id = rm.listing_id
    AND aq.visibility IS NOT NULL
    AND aq.visibility->>'sourceQuestionKey' = rm.old_key
    AND rm.old_key IS DISTINCT FROM rm.new_key;

  UPDATE passport_additional_questions pq
  SET visibility = jsonb_set(
    pq.visibility,
    '{sourceQuestionKey}',
    to_jsonb(rm.new_key)
  )
  FROM _qc_key_remap rm
  WHERE rm.src = 'passport'
    AND pq.passport_listing_id = rm.listing_id
    AND pq.visibility IS NOT NULL
    AND pq.visibility->>'sourceQuestionKey' = rm.old_key
    AND rm.old_key IS DISTINCT FROM rm.new_key;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "additional_questions_catalog_question_id_idx"
  ON "additional_questions" USING btree ("catalog_question_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "additional_questions_listing_catalog_unique"
  ON "additional_questions" USING btree ("visa_listing_id", "catalog_question_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "additional_questions_listing_key_unique"
  ON "additional_questions" USING btree ("visa_listing_id", "key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passport_additional_questions_catalog_question_id_idx"
  ON "passport_additional_questions" USING btree ("catalog_question_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passport_additional_questions_listing_catalog_unique"
  ON "passport_additional_questions" USING btree ("passport_listing_id", "catalog_question_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passport_additional_questions_listing_key_unique"
  ON "passport_additional_questions" USING btree ("passport_listing_id", "key");
