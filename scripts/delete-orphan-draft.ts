import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  // Drafts recreated after a submit for the same user+listing (updated_at >= submitted_at)
  const deleted = await sql`
    DELETE FROM application_drafts d
    WHERE EXISTS (
      SELECT 1
      FROM visa_applications a
      WHERE a.user_id = d.user_id
        AND a.visa_listing_id = d.listing_id
        AND a.submitted_at IS NOT NULL
        AND d.updated_at >= a.submitted_at
    )
    RETURNING d.id, d.listing_id, d.user_id, d.updated_at
  `;
  console.log('Deleted post-submit orphan drafts:', deleted);

  const left = await sql`
    SELECT id, listing_id, user_id, updated_at,
           payload->>'processName' AS process_name
    FROM application_drafts
    ORDER BY updated_at DESC
  `;
  console.log('Remaining drafts:', left);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
