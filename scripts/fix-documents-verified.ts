/**
 * Fix documents.verified tri-state:
 * null = unverified, true = verified, false = rejected.
 * Old default of false made every new upload look "Rejected".
 */
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql.unsafe(
    'ALTER TABLE documents ALTER COLUMN verified DROP DEFAULT'
  );
  console.log('dropped verified default');

  const updated = await sql.unsafe(`
    UPDATE documents
    SET verified = NULL
    WHERE verified = false
      AND (verification_notes IS NULL OR verification_notes = '')
  `);
  console.log('reset false→null rows:', updated.count ?? updated);

  await sql.end();
  console.log('documents verified fix ok');
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
