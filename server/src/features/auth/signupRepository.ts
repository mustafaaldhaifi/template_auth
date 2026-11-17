import { randomUUID } from 'node:crypto';
import { getDatabasePool } from '@/lib/database';

export type NewAccount = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
};

/**
 * Creates the user, email, and password rows as one database transaction.
 * 1. Reserve one database client and begin the transaction.
 * 2. Insert the three related rows with parameterized queries.
 * 3. Commit on success, or roll back on failure, then release the client.
 */
export async function createSignupAccount(account: NewAccount): Promise<string> {
  const client = await getDatabasePool().connect();
  const userId = randomUUID();
  const emailId = randomUUID();
  let discardClient = false;

  try {
    // STEP 1: Keep all writes on the same client and transaction.
    await client.query('BEGIN');

    // STEP 2: Create the identity and its credential records together.
    await client.query(
      'INSERT INTO public.users (id, first_name, last_name) VALUES ($1, $2, $3)',
      [userId, account.firstName, account.lastName],
    );
    await client.query(
      'INSERT INTO public.user_emails (id, user_id, email) VALUES ($1, $2, $3)',
      [emailId, userId, account.email],
    );
    await client.query(
      'INSERT INTO public.user_passwords (user_id, password_hash) VALUES ($1, $2)',
      [userId, account.passwordHash],
    );

    // STEP 3: Make all rows visible only after every insert succeeds.
    await client.query('COMMIT');
    return userId;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // NOTE: A connection that cannot roll back must not return to the pool.
      discardClient = true;
    }
    throw error;
  } finally {
    client.release(discardClient);
  }
}
