import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env' });
config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing');
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  try {
    const updated = await sql`
      UPDATE visa_listings
      SET
        process_name = 'Arrival Card',
        process_type_label = 'Arrival Card',
        entry_type = 'Arrival Card',
        process_type = 'digital_arrival_card',
        purpose = 'visa_on_arrival'
      WHERE id = '553587f2-ccd0-45f0-a7f5-4809caf7f3cb'
      RETURNING id, process_name, process_type, process_type_label, purpose, slug
    `;
    console.log(updated);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
