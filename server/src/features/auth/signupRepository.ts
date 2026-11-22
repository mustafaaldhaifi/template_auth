import { randomUUID } from 'node:crypto';
import { getDatabase } from '@/lib/database';

export type NewAccount = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
};

/**
 * Creates the user, email, and password rows as one database transaction.
 * 1. Generate identifiers for the related rows.
 * 2. Insert all three rows through the query builder in one transaction.
 * 3. Return the user ID after the transaction commits.
 */
export async function createSignupAccount(account: NewAccount): Promise<string> {
  // STEP 1: Keep identifiers stable across the related inserts.
  const userId = randomUUID();
  const emailId = randomUUID();

  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 2: A failed insert rolls back every write in this callback.
    await transaction.insertInto('users')
      .values({ id: userId, first_name: account.firstName, last_name: account.lastName })
      .execute();
    await transaction.insertInto('user_emails')
      .values({ id: emailId, user_id: userId, email: account.email })
      .execute();
    await transaction.insertInto('user_passwords')
      .values({ user_id: userId, password_hash: account.passwordHash })
      .execute();

    // STEP 3: Kysely commits only when every insert has completed.
    return userId;
  });
}

/** Resolves an active country from the server catalog instead of trusting a client calling code. */
export async function findSignupCountry(iso2: string): Promise<{ id: number; dialCode: string } | null> {
  const row = await getDatabase().selectFrom('country_codes')
    .select(['id', 'dial_code'])
    .where('iso2', '=', iso2)
    .where('is_active', '=', true)
    .executeTakeFirst();
  return row ? { id: row.id, dialCode: row.dial_code } : null;
}

/**
 * Creates a phone-only account after its signed code is verified.
 * 1. Allocate account and phone identifiers.
 * 2. Store the user, password, and verified phone in one transaction.
 */
export async function createPhoneSignupAccount(account: {
  firstName: string; lastName: string; passwordHash: string;
  phone: string; countryId: number;
}): Promise<string> {
  // STEP 1: Keep IDs stable if any insert fails and the transaction rolls back.
  const userId = randomUUID();
  const phoneId = randomUUID();
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 2: No phone-only account can exist without its password and verified number.
    await transaction.insertInto('users')
      .values({ id: userId, first_name: account.firstName, last_name: account.lastName })
      .execute();
    await transaction.insertInto('user_passwords')
      .values({ user_id: userId, password_hash: account.passwordHash })
      .execute();
    await transaction.insertInto('user_phones')
      .values({ id: phoneId, user_id: userId, country_code_id: account.countryId,
        phone_e164: account.phone, verified_at: new Date() })
      .execute();
    return userId;
  });
}
