import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env' });
config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing');
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const ddlPath = './lib/db/migrations/0048_digital_arrival_card.sql';
  const ddl = readFileSync(ddlPath, 'utf8');
  const hash = createHash('sha256').update(ddl).digest('hex');

  try {
    await sql.unsafe(ddl);
    console.log('0048 DDL applied');

    const existing = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM drizzle.__drizzle_migrations
      WHERE hash = ${hash}
    `;

    if (Number(existing[0]?.count || 0) === 0) {
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${1796000000000})
      `;
      console.log('0048 recorded in drizzle.__drizzle_migrations');
    } else {
      console.log('0048 already recorded in drizzle.__drizzle_migrations');
    }

    const labels = await sql<{ enumlabel: string }[]>`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'process_type'
      ORDER BY e.enumsortorder
    `;
    console.log('process_type=', labels.map((row) => row.enumlabel).join(', '));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
