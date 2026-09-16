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
    await sql.unsafe(`ALTER TYPE "question_type" ADD VALUE IF NOT EXISTS 'checkbox'`);
    await sql.unsafe(`ALTER TYPE "question_type" ADD VALUE IF NOT EXISTS 'radio'`);
    console.log('question_type enum values checkbox and radio ensured');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
