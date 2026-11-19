import { type Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export interface DatabaseTables {
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
    code_salt: string | null;
    verified_token_hash: string | null;
  };
  platforms: {
    id: Generated<number>;
    code: 'ios' | 'android' | 'web';
  };
  devices: {
    id: Generated<string>;
    device_token_hash: string;
    platform_id: number;
    os_version: string | null;
    model: string | null;
    created_at: Generated<Date>;
    last_seen_at: Generated<Date>;
  };
  ips: {
    id: Generated<string>;
    address: string;
    created_at: Generated<Date>;
    last_seen_at: Generated<Date>;
  };
  ip_devices: {
    device_id: string;
    ip_id: string;
    created_at: Generated<Date>;
    last_seen_at: Generated<Date>;
  };
  auth_sessions: {
    id: Generated<string>;
    token_hash: string;
    user_id: string;
    device_id: string;
    login_ip_id: string | null;
    created_at: Generated<Date>;
    expires_at: Date;
    revoked_at: Date | null;
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
