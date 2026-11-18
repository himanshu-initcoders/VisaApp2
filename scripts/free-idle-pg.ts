/**
 * One-shot: terminate idle backends so local Next/Turbopack can connect again.
 * Run: npx tsx scripts/free-idle-pg.ts
 */
import postgres from 'postgres';

const url =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/Prod_Viserv';

const sql = postgres(url, { max: 1, connect_timeout: 8 });

async function main() {
  try {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
    `;
    console.log('pg_stat_activity count:', n);

    const byState = await sql`
      select state, count(*)::int as n
      from pg_stat_activity
      where datname = current_database()
      group by state
      order by n desc
    `;
    console.log('by state:', byState);

    const killed = await sql`
      select pg_terminate_backend(pid) as ok, pid
      from pg_stat_activity
      where datname = current_database()
        and pid <> pg_backend_pid()
        and state = 'idle'
    `;
    console.log('terminated idle:', killed.length);
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
