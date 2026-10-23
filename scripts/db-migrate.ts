/**
 * Wrapper around drizzle-kit migrate with clear errors for:
 * - missing DATABASE_URL
 * - Postgres not running / database does not exist
 * - migration drift (tables already exist from ad-hoc scripts)
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import postgres from 'postgres';

function dbNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '') || '(unknown)';
  } catch {
    return '(unparsed)';
  }
}

async function assertDatabaseReady(url: string) {
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 8 });
  try {
    await sql`select 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = dbNameFromUrl(url);

    if (/ECONNREFUSED|connect ECONNREFUSED/i.test(message)) {
      console.error(
        `Cannot connect to Postgres (connection refused).\n` +
          `Start Postgres, then retry: npm run db:migrate`
      );
      process.exit(1);
    }

    if (/database ".*" does not exist|3D000/i.test(message)) {
      console.error(
        `Database "${name}" does not exist.\n` +
          `Create it first, e.g.:\n` +
          `  createdb ${name}\n` +
          `  # or in psql: CREATE DATABASE ${name};\n` +
          `Then run: npm run db:migrate`
      );
      process.exit(1);
    }

    console.error(`Database connection failed: ${message}`);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'DATABASE_URL is missing. Add it to .env (see .env.example), then retry.'
    );
    process.exit(1);
  }

  await assertDatabaseReady(url);

  const child = spawn('npx drizzle-kit migrate', {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`drizzle-kit migrate killed by signal ${signal}`);
      process.exit(1);
    }
    if (code !== 0) {
      console.error(
        `\nMigration failed (exit ${code}).\n` +
          `If this database was previously updated with ad-hoc apply scripts,\n` +
          `drizzle.__drizzle_migrations is likely out of sync with the SQL files.\n` +
          `Repair with: npm run db:baseline\n` +
          `Then retry: npm run db:migrate`
      );
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
