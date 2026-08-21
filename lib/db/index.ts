import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as schemaExtended from './schema-extended';

// Combine all schema tables + relations for typed db.query.*
const allSchema = { ...schema, ...schemaExtended };

export type Database = PostgresJsDatabase<typeof allSchema>;

/**
 * Database Connection
 *
 * IMPORTANT: Create a .env file with DATABASE_URL before running the app.
 * See .env.example for the required format.
 */

// Lazy initialization to avoid errors during build time
let _db: Database | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function initializeDb(): Database {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL environment variable is not set.\n' +
      'Please create a .env file with your database connection string.\n' +
      'See .env.example for the required format.'
    );
  }

  _client = postgres(process.env.DATABASE_URL);
  _db = drizzle(_client, { schema: allSchema });

  return _db;
}

// Export a getter that initializes on first use
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = initializeDb();
    return instance[prop as keyof Database];
  },
});
