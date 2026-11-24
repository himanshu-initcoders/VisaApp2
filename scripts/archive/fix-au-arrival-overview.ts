import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env' });
config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const description =
    "<p>Complete Australia's arrival card online before you travel. Viserv helps Indian travellers prepare the form, check details, and submit with clear fees and timelines.</p>";

  try {
    const rows = await sql`
      UPDATE visa_listings
      SET description = ${description}
      WHERE id = '553587f2-ccd0-45f0-a7f5-4809caf7f3cb'
      RETURNING left(description, 120) AS preview
    `;
    console.log(rows);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
