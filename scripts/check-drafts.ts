import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  console.log('DB:', process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@'));

  const drafts = await sql`
    SELECT d.id, d.user_id, d.listing_id, d.country_code, d.updated_at,
           d.payload->>'processName' AS process_name,
           d.payload->>'primaryName' AS primary_name,
           u.email, u.name, u.role
    FROM application_drafts d
    LEFT JOIN users u ON u.id = d.user_id
    ORDER BY d.updated_at DESC
    LIMIT 20
  `;

  const apps = await sql`
    SELECT a.id, a.user_id, a.visa_listing_id, a.status, a.submit_id,
           a.submitted_at, a.created_at, a.country, a.visa_type,
           u.email
    FROM visa_applications a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 15
  `;

  const orphans = await sql`
    SELECT d.id AS draft_id, d.user_id, d.listing_id, d.updated_at AS draft_updated,
           a.id AS application_id, a.status, a.submitted_at, u.email
    FROM application_drafts d
    INNER JOIN visa_applications a
      ON a.user_id = d.user_id
     AND a.visa_listing_id = d.listing_id
    LEFT JOIN users u ON u.id = d.user_id
    ORDER BY a.created_at DESC
    LIMIT 20
  `;

  console.log('\n=== APPLICATION_DRAFTS count:', drafts.length);
  console.log(JSON.stringify(drafts, null, 2));
  console.log('\n=== RECENT VISA_APPLICATIONS count:', apps.length);
  console.log(JSON.stringify(apps, null, 2));
  console.log('\n=== ORPHAN DRAFTS (same user+listing as an app):', orphans.length);
  console.log(JSON.stringify(orphans, null, 2));

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
