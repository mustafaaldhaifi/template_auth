import { getDatabase } from '@/lib/database';

export type LoginAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
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
    email: row.email, phone: null, passwordHash: row.password_hash,
  } : null;
}

/** Finds a password account by its verified international phone number. */
export async function findLoginAccountByPhone(phone: string): Promise<LoginAccount | null> {
  const row = await getDatabase()
    .selectFrom('user_phones as p')
    .innerJoin('users as u', 'u.id', 'p.user_id')
    .innerJoin('user_passwords as c', 'c.user_id', 'u.id')
    .select(['u.id', 'u.first_name', 'u.last_name', 'p.phone_e164', 'c.password_hash'])
    .where('p.phone_e164', '=', phone)
    .where('p.verified_at', 'is not', null)
    .executeTakeFirst();
  return row ? { id: row.id, firstName: row.first_name, lastName: row.last_name,
    email: null, phone: row.phone_e164, passwordHash: row.password_hash } : null;
}
