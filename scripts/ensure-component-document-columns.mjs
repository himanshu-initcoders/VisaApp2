import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await sql.unsafe(`
      ALTER TABLE "components_required" ADD COLUMN IF NOT EXISTS "document_type" varchar(80);
      ALTER TABLE "components_required" ADD COLUMN IF NOT EXISTS "label" text;
    `);

    await sql.unsafe(`
      UPDATE "components_required"
      SET "document_type" = "key"
      WHERE "document_type" IS NULL
        AND "key" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    `);

    await sql.unsafe(`
      UPDATE "components_required"
      SET "label" = initcap(replace(coalesce("document_type", "key"), '_', ' '))
      WHERE "label" IS NULL;
    `);

    console.log('document_type and label columns ensured on components_required');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
