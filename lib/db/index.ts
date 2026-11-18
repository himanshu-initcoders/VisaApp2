import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as schemaExtended from './schema-extended';
import * as schemaPassport from './schema-passport';

// Combine all schema tables + relations for typed db.query.*
const allSchema = { ...schema, ...schemaExtended, ...schemaPassport };

export type Database = PostgresJsDatabase<typeof allSchema>;

/**
 * Database Connection
 *
 * IMPORTANT: Create a .env file with DATABASE_URL before running the app.
 * See .env.example for the required format.
 *
 * Dev/HMR: store the client on globalThis so Turbopack reloads do not open a
 * new pool every time (that exhausts Postgres → ECONNRESET / JWTSessionError).
 */

type DbGlobals = {
  __visaPgClient?: ReturnType<typeof postgres>;
  __visaDb?: Database;
};

const globalForDb = globalThis as typeof globalThis & DbGlobals;

function initializeDb(): Database {
  if (globalForDb.__visaDb) {
    return globalForDb.__visaDb;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL environment variable is not set.\n' +
        'Please create a .env file with your database connection string.\n' +
        'See .env.example for the required format.'
    );
  }

  const client =
    globalForDb.__visaPgClient ??
    postgres(process.env.DATABASE_URL, {
      // Keep the Next.js pool small; scripts use their own short-lived clients.
      max: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
    });

  const instance = drizzle(client, { schema: allSchema });

  globalForDb.__visaPgClient = client;
  globalForDb.__visaDb = instance;

  return instance;
}

// Export a getter that initializes on first use
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = initializeDb();
    return instance[prop as keyof Database];
  },
});
