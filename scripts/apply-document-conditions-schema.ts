import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql.unsafe(
    `ALTER TABLE additional_questions ADD COLUMN IF NOT EXISTS document_conditions jsonb DEFAULT 'null'::jsonb`
  );
  await sql.end();
  console.log('document_conditions column ok');
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
