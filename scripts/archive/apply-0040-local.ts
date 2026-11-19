import { readFileSync } from 'fs';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env' });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing');
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const ddl = readFileSync('./lib/db/migrations/0040_passenger_profiles.sql', 'utf8');
  const parts = ddl
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    try {
      await sql.unsafe(part);
      console.log('OK', part.slice(0, 72).replace(/\s+/g, ' '));
    } catch (error) {
      console.error(
        'FAIL',
        part.slice(0, 90).replace(/\s+/g, ' '),
        error instanceof Error ? error.message : error
      );
    }
  }
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
