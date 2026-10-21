import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const migrationPath = join(
    process.cwd(),
    'lib/db/migrations/0015_document_types.sql'
  );
  const raw = readFileSync(migrationPath, 'utf8');
  const statements = raw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.unsafe(statement);
    console.log('ok:', statement.slice(0, 80).replace(/\s+/g, ' ') + '…');
  }

  await sql.end();
  console.log('document_types schema ok');
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
