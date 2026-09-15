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
      ALTER TABLE "visa_listings" ADD COLUMN IF NOT EXISTS "show_general_info" boolean DEFAULT true NOT NULL;
      ALTER TABLE "visa_listings" ADD COLUMN IF NOT EXISTS "show_trip_details" boolean DEFAULT true NOT NULL;
    `);
    console.log('show_general_info and show_trip_details ensured on visa_listings');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
