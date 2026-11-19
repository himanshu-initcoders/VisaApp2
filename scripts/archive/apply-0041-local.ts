import { readFileSync } from 'fs';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env' });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing');
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const ddl = readFileSync(
    './lib/db/migrations/0041_form_traveller_id_naming.sql',
    'utf8'
  );
  await sql.unsafe(ddl);
  console.log('0041 applied');
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
