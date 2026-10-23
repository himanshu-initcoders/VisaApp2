import 'dotenv/config';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('MISSING_DATABASE_URL');
    process.exit(1);
  }

  const migrationsDir = join(process.cwd(), 'lib/db/migrations');
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8')
  ) as { entries: Array<{ idx: number; tag: string }> };

  const sqlFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log('sql_files_on_disk=' + sqlFiles.length);
  console.log('journal_count=' + journal.entries.length);

  const missingSql: string[] = [];
  for (const entry of journal.entries) {
    const path = join(migrationsDir, `${entry.tag}.sql`);
    if (!existsSync(path)) {
      missingSql.push(entry.tag);
      continue;
    }
    const body = readFileSync(path, 'utf8');
    const hash = createHash('sha256').update(body).digest('hex');
    console.log(`journal #${entry.idx} ${entry.tag} hash=${hash.slice(0, 16)}… bytes=${body.length}`);
  }
  if (missingSql.length) {
    console.log('missing_sql=' + missingSql.join(','));
  }

  const orphans = sqlFiles.filter(
    (f) => !journal.entries.some((e) => `${e.tag}.sql` === f)
  );
  if (orphans.length) {
    console.log('orphan_sql_not_in_journal=' + orphans.join(','));
  }

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const [meta] = await sql<{ mig: string | null }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations')::text AS mig
    `;
    console.log('drizzle_migrations_table=' + (meta?.mig ? 'yes' : 'no'));

    if (!meta?.mig) {
      console.log('applied_count=0');
      console.log('STATUS=empty_db_or_no_history');
      return;
    }

    const applied = await sql<{ id: number; hash: string; created_at: string }[]>`
      SELECT id, hash, created_at::text
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at ASC, id ASC
    `;
    console.log('applied_count=' + applied.length);
    applied.forEach((row, i) => {
      console.log(
        `applied #${i} id=${row.id} hash=${row.hash.slice(0, 16)}… at=${row.created_at}`
      );
    });

    // Match journal file hashes to applied hashes
    const journalHashes = journal.entries.map((entry) => {
      const path = join(migrationsDir, `${entry.tag}.sql`);
      if (!existsSync(path)) return { tag: entry.tag, hash: null as string | null };
      const body = readFileSync(path, 'utf8');
      return {
        tag: entry.tag,
        hash: createHash('sha256').update(body).digest('hex'),
      };
    });

    const appliedSet = new Set(applied.map((a) => a.hash));
    const matched = journalHashes.filter((j) => j.hash && appliedSet.has(j.hash));
    const unmatchedJournal = journalHashes.filter(
      (j) => j.hash && !appliedSet.has(j.hash)
    );
    const unmatchedApplied = applied.filter(
      (a) => !journalHashes.some((j) => j.hash === a.hash)
    );

    console.log('hash_matched=' + matched.length);
    console.log(
      'journal_not_in_db=' +
        (unmatchedJournal.map((j) => j.tag).join(',') || '(none)')
    );
    console.log(
      'db_hashes_not_in_journal_files=' + unmatchedApplied.length
    );

    const pendingByCount = Math.max(0, journal.entries.length - applied.length);
    console.log('pending_by_count=' + pendingByCount);
    if (pendingByCount > 0) {
      console.log(
        'pending_tags_by_count=' +
          journal.entries.slice(applied.length).map((e) => e.tag).join(',')
      );
    }

    // Probe schema facts for late migrations
    const probes = await sql<{ name: string; ok: boolean }[]>`
      SELECT 'col_document_conditions' AS name,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='additional_questions'
            AND column_name='document_conditions'
        ) AS ok
      UNION ALL
      SELECT 'col_saved_by_user_id',
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='application_drafts'
            AND column_name='saved_by_user_id'
        )
      UNION ALL
      SELECT 'table_document_types',
        to_regclass('public.document_types') IS NOT NULL
      UNION ALL
      SELECT 'table_form_field_mappings',
        to_regclass('public.form_field_mappings') IS NOT NULL
      UNION ALL
      SELECT 'fk_drafts_listing',
        EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname='application_drafts_listing_id_visa_listings_id_fk'
        )
    `;
    for (const p of probes) {
      console.log(`probe_${p.name}=${p.ok ? 'yes' : 'no'}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
