import { getDatabase } from '@/lib/database';

export type LoginAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
};

/** Finds an account and its credential by its normalized email address. */
export async function findLoginAccount(email: string): Promise<LoginAccount | null> {
  const row = await getDatabase()
    .selectFrom('user_emails as e')
    .innerJoin('users as u', 'u.id', 'e.user_id')
    .innerJoin('user_passwords as p', 'p.user_id', 'u.id')
    .select(['u.id', 'u.first_name', 'u.last_name', 'e.email', 'p.password_hash'])
    .where('e.email', '=', email)
    .executeTakeFirst();
  return row ? {
    id: row.id, firstName: row.first_name, lastName: row.last_name,
    email: row.email, passwordHash: row.password_hash,
  } : null;
}
