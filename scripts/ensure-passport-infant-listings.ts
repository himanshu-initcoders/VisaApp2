/**
 * Clone Fresh / Re-issue passport catalog into infant variants.
 * Must run AFTER migration 0052 commits (new enum labels cannot be used
 * in the same transaction that adds them — Drizzle migrates in one TX).
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });

  try {
    const enumReady = await sql`
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'passport_service_type'
        AND e.enumlabel IN ('fresh_infant', 'reissue_infant')
    `;
    if (enumReady.length < 2) {
      console.error(
        'passport_service_type is missing fresh_infant/reissue_infant. Run migrations first (0052).'
      );
      process.exit(1);
    }

    await sql.unsafe(`
DO $$
DECLARE
  src_listing_id uuid;
  new_listing_id uuid;
  src_step record;
  new_step_id uuid;
  pair record;
BEGIN
  FOR pair IN
    SELECT *
    FROM (
      VALUES
        (
          'fresh'::passport_service_type,
          'fresh_infant'::passport_service_type,
          'a1000000-0000-4000-8000-000000000003'::uuid,
          'Fresh Passport (Infant)',
          'fresh-passport-infant',
          'For first-time infant applicants who have never held an Indian passport.'
        ),
        (
          'reissue'::passport_service_type,
          'reissue_infant'::passport_service_type,
          'a1000000-0000-4000-8000-000000000004'::uuid,
          'Re-Issue (Infant)',
          'reissue-passport-infant',
          'For infant passport expiry, near-expiry, exhausted pages, change in particulars, lost, or damaged passport cases.'
        )
    ) AS v(src_type, new_type, new_id, new_name, new_slug, new_description)
  LOOP
    IF EXISTS (
      SELECT 1 FROM passport_listings WHERE service_type = pair.new_type
    ) THEN
      CONTINUE;
    END IF;

    SELECT id INTO src_listing_id
    FROM passport_listings
    WHERE service_type = pair.src_type
    LIMIT 1;

    IF src_listing_id IS NULL THEN
      RAISE EXCEPTION 'Source passport listing % not found', pair.src_type;
    END IF;

    new_listing_id := pair.new_id;

    INSERT INTO passport_listings (
      id,
      service_type,
      name,
      slug,
      description,
      standard_eta_duration,
      standard_eta_unit,
      is_active,
      seo,
      last_edited_by,
      created_at,
      updated_at
    )
    SELECT
      new_listing_id,
      pair.new_type,
      pair.new_name,
      pair.new_slug,
      pair.new_description,
      src.standard_eta_duration,
      src.standard_eta_unit,
      src.is_active,
      src.seo,
      src.last_edited_by,
      NOW(),
      NOW()
    FROM passport_listings src
    WHERE src.id = src_listing_id;

    INSERT INTO passport_listing_prices (
      passport_listing_id,
      scheme,
      booklet_pages,
      government_fee_amount,
      service_fee_amount,
      government_gst_fee_amount,
      sort_order,
      created_at
    )
    SELECT
      new_listing_id,
      scheme,
      booklet_pages,
      government_fee_amount,
      service_fee_amount,
      government_gst_fee_amount,
      sort_order,
      NOW()
    FROM passport_listing_prices
    WHERE passport_listing_id = src_listing_id;

    CREATE TEMP TABLE IF NOT EXISTS tmp_passport_step_map (
      src_step_id uuid PRIMARY KEY,
      new_step_id uuid NOT NULL
    ) ON COMMIT DROP;
    DELETE FROM tmp_passport_step_map;

    FOR src_step IN
      SELECT id, title, description, sort_order
      FROM passport_form_steps
      WHERE passport_listing_id = src_listing_id
      ORDER BY sort_order, created_at
    LOOP
      new_step_id := gen_random_uuid();
      INSERT INTO passport_form_steps (
        id,
        passport_listing_id,
        title,
        description,
        sort_order,
        created_at
      ) VALUES (
        new_step_id,
        new_listing_id,
        src_step.title,
        src_step.description,
        src_step.sort_order,
        NOW()
      );
      INSERT INTO tmp_passport_step_map (src_step_id, new_step_id)
      VALUES (src_step.id, new_step_id);
    END LOOP;

    INSERT INTO passport_additional_questions (
      passport_listing_id,
      step_id,
      catalog_question_id,
      key,
      label,
      description,
      question_type,
      required,
      extra_info,
      required_doc,
      source_url,
      options,
      visibility,
      document_conditions,
      sort_order,
      created_at
    )
    SELECT
      new_listing_id,
      map.new_step_id,
      q.catalog_question_id,
      q.key,
      q.label,
      q.description,
      q.question_type,
      q.required,
      q.extra_info,
      q.required_doc,
      q.source_url,
      q.options,
      q.visibility,
      q.document_conditions,
      q.sort_order,
      NOW()
    FROM passport_additional_questions q
    INNER JOIN tmp_passport_step_map map ON map.src_step_id = q.step_id
    WHERE q.passport_listing_id = src_listing_id;

    INSERT INTO passport_components_required (
      passport_listing_id,
      key,
      document_type,
      label,
      amount,
      chargeable,
      toggle,
      attributes,
      sort_order,
      source_url,
      created_at
    )
    SELECT
      new_listing_id,
      key,
      document_type,
      label,
      amount,
      chargeable,
      toggle,
      attributes,
      sort_order,
      source_url,
      NOW()
    FROM passport_components_required
    WHERE passport_listing_id = src_listing_id;

    INSERT INTO passport_faqs (
      passport_listing_id,
      question,
      answer,
      category,
      sort_order,
      created_at
    )
    SELECT
      new_listing_id,
      question,
      answer,
      category,
      sort_order,
      NOW()
    FROM passport_faqs
    WHERE passport_listing_id = src_listing_id;
  END LOOP;
END $$;
`);

    const listings = await sql`
      SELECT service_type, name, slug
      FROM passport_listings
      WHERE service_type::text LIKE '%infant%'
      ORDER BY service_type
    `;
    if (listings.length === 0) {
      console.error('Infant passport listings were not created');
      process.exit(1);
    }
    console.log(
      'passport infant listings ok:',
      listings.map((l) => l.service_type).join(', ')
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
