import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql.unsafe(
    'ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL'
  );
  console.log('password_hash nullable');

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS application_drafts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
      listing_id uuid NOT NULL,
      country_code char(2),
      payload jsonb NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  console.log('application_drafts table');

  await sql.unsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS application_drafts_user_listing_unique ON application_drafts (user_id, listing_id)'
  );
  console.log('drafts unique index');

  await sql.unsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone)'
  );
  console.log('phone unique index');

  await sql.end();
  console.log('phase2 schema ok');
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
