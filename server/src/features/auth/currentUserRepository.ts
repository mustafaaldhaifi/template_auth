import { getDatabase } from '@/lib/database';

export type CurrentUser = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

/** Finds the public account details for a signed-in user. */
export async function findCurrentUser(userId: string): Promise<CurrentUser | null> {
  const row = await getDatabase()
    .selectFrom('users as u')
    .leftJoin('user_emails as e', 'e.user_id', 'u.id')
    .leftJoin('user_phones as p', 'p.user_id', 'u.id')
    .select(['u.first_name', 'u.last_name', 'e.email', 'p.phone_e164'])
    .where('u.id', '=', userId)
    .executeTakeFirst();

  return row ? {
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone_e164,
  } : null;
}
