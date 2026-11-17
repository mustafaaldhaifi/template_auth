import { Pool } from 'pg';

let databasePool: Pool | undefined;

/** Returns the shared PostgreSQL pool, creating it from the server environment when first needed. */
export function getDatabasePool(): Pool {
  if (!databasePool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }

    databasePool = new Pool({ connectionString });
  }

  return databasePool;
}
