/**
 * Repair drizzle.__drizzle_migrations to match journal SQL files.
 *
 * Use when the live schema was applied via ad-hoc scripts / db:push / manual SQL,
 * so hashes in drizzle.__drizzle_migrations no longer match lib/db/migrations/*.sql.
 *
 * Safe only when the database schema already matches the TypeScript schema
 * (or you accept marking history without re-running SQL).
 *
 * Fresh empty databases should use `npm run db:migrate` instead — not baseline.
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('MISSING_DATABASE_URL');
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const migrationsDir = join(process.cwd(), 'lib/db/migrations');
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8')
  ) as { entries: Array<{ idx: number; tag: string; when: number }> };

  const rows: Array<{ hash: string; created_at: number; tag: string }> = [];
  for (const entry of journal.entries) {
    const path = join(migrationsDir, `${entry.tag}.sql`);
    if (!existsSync(path)) {
      console.error(`Missing migration SQL: ${entry.tag}.sql`);
      process.exit(1);
    }
    const body = readFileSync(path, 'utf8');
    rows.push({
      tag: entry.tag,
      hash: createHash('sha256').update(body).digest('hex'),
      created_at: entry.when,
    });
  }

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    if (!force) {
      const [probe] = await sql<{ users: string | null }[]>`
        SELECT to_regclass('public.users')::text AS users
      `;
      if (!probe?.users) {
        console.error(
          'No public.users table — this looks like an empty database.\n' +
            'Use `npm run db:migrate` instead of baseline.'
        );
        process.exit(1);
      }
      console.log(
        'About to REPLACE drizzle.__drizzle_migrations with ' +
          rows.length +
          ' journal hashes.\n' +
          'This does NOT run SQL — it only repairs migration history.\n' +
          'Re-run with --force to apply.'
      );
      for (const row of rows) {
        console.log(`  ${row.tag} ${row.hash.slice(0, 16)}…`);
      }
      process.exit(0);
    }

    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    await sql.begin(async (tx) => {
      await tx`DELETE FROM drizzle.__drizzle_migrations`;
      for (const row of rows) {
        await tx`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${row.hash}, ${row.created_at})
        `;
      }
    });

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    console.log(
      `Baselined drizzle.__drizzle_migrations: ${count} rows (journal=${rows.length}).`
    );
    console.log('Next: npm run db:migrate  (should apply nothing)');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
