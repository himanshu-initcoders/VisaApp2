/**
 * Read-only: compare drizzle journal vs applied migrations on DATABASE_URL.
 * Does not print connection strings or secrets.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('MISSING_DATABASE_URL');
    process.exit(1);
  }
  if (/localhost|127\.0\.0\.1/i.test(url)) {
    console.error('REFUSING_LOCALHOST — expected production URL');
    process.exit(1);
  }

  let host = 'unparsed';
  try {
    host = new URL(url).hostname;
  } catch {
    // ignore
  }
  console.log('target_host=' + host);

  const journal = JSON.parse(
    readFileSync(
      join(process.cwd(), 'lib/db/migrations/meta/_journal.json'),
      'utf8'
    )
  ) as { entries: Array<{ idx: number; tag: string }> };

  const sql = postgres(url, { max: 1, prepare: false });

  try {
    const [meta] = await sql<{ mig: string | null; drafts: string | null }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations')::text AS mig,
             to_regclass('public.application_drafts')::text AS drafts
    `;
    console.log('drizzle_migrations_table=' + (meta?.mig ? 'yes' : 'no'));
    console.log('application_drafts_table=' + (meta?.drafts ? 'yes' : 'no'));

    let appliedCount = 0;
    if (meta?.mig) {
      const applied = await sql<{ id: number; hash: string }[]>`
        SELECT id, hash
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at ASC, id ASC
      `;
      appliedCount = applied.length;
      console.log('applied_count=' + appliedCount);
      for (const row of applied) {
        console.log(`applied #${row.id} hash=${row.hash.slice(0, 16)}…`);
      }
    }

    console.log('journal_count=' + journal.entries.length);
    const pendingCount = Math.max(0, journal.entries.length - appliedCount);
    console.log('pending_by_count=' + pendingCount);
    if (pendingCount > 0) {
      const pending = journal.entries.slice(appliedCount).map((e) => e.tag);
      console.log('pending_tags=' + pending.join(','));
    } else {
      console.log('pending_tags=(none)');
    }

    if (meta?.drafts) {
      const [col] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'application_drafts'
            AND column_name = 'saved_by_user_id'
        ) AS exists
      `;
      console.log('col_saved_by_user_id=' + (col?.exists ? 'yes' : 'no'));

      const [fk] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'application_drafts_listing_id_visa_listings_id_fk'
        ) AS exists
      `;
      console.log('fk_listing_id=' + (fk?.exists ? 'yes' : 'no'));

      const [orphans] = await sql<{ c: number }[]>`
        SELECT count(*)::int AS c
        FROM application_drafts d
        WHERE NOT EXISTS (
          SELECT 1 FROM visa_listings v WHERE v.id = d.listing_id
        )
      `;
      console.log('orphan_drafts_for_fk=' + orphans?.c);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
