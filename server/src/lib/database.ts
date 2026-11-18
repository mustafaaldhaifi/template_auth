import { type Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

interface DatabaseTables {
  users: {
    id: string;
    first_name: string;
    last_name: string;
    created_at: Generated<Date>;
  };
  user_emails: {
    id: string;
    user_id: string;
    email: string;
    created_at: Generated<Date>;
  };
  user_passwords: {
    user_id: string;
    password_hash: string;
    created_at: Generated<Date>;
  };
  password_reset_tokens: {
    token_hash: string;
    user_id: string;
    expires_at: Date;
    consumed_at: Date | null;
    created_at: Generated<Date>;
  };
}

let database: Kysely<DatabaseTables> | undefined;

/** Returns the shared, typed query builder using the existing PostgreSQL connection setting. */
export function getDatabase(): Kysely<DatabaseTables> {
  if (!database) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }

    database = new Kysely<DatabaseTables>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
    }).withSchema('public');
  }

  return database;
}
