import { getDatabase } from '@/lib/database';

export type PasswordResetAccount = { userId: string; email: string };

/** Finds a password account by its normalized email address. */
export async function findPasswordResetAccount(email: string): Promise<PasswordResetAccount | null> {
  const row = await getDatabase()
    .selectFrom('user_emails as e')
    .innerJoin('user_passwords as p', 'p.user_id', 'e.user_id')
    .select(['e.user_id', 'e.email'])
    .where('e.email', '=', email)
    .executeTakeFirst();
  return row ? { userId: row.user_id, email: row.email } : null;
}

/**
 * Stores a reset token while limiting each account to one request per minute.
 * 1. Lock the credential row to serialize requests for this account.
 * 2. Skip issuance if a token was recently created.
 * 3. Store only the token hash and expiration.
 */
export async function issuePasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<boolean> {
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 1: Keep simultaneous requests from sending several links.
    const credential = await transaction.selectFrom('user_passwords')
      .select('user_id')
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!credential) return false;

    // STEP 2: Apply a per-account cooldown without revealing it to the caller.
    const recent = await transaction.selectFrom('password_reset_tokens')
      .select('token_hash')
      .where('user_id', '=', userId)
      .where('created_at', '>', new Date(Date.now() - 60_000))
      .executeTakeFirst();
    if (recent) return false;

    // STEP 3: The raw bearer token exists only in the email link.
    await transaction.insertInto('password_reset_tokens')
      .values({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt, consumed_at: null })
      .execute();
    return true;
  });
}

/** Removes an unsent token when email delivery fails. */
export async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  await getDatabase().deleteFrom('password_reset_tokens')
    .where('token_hash', '=', tokenHash)
    .execute();
}

/** Checks token validity before spending work hashing a new password. */
export async function hasActivePasswordResetToken(tokenHash: string): Promise<boolean> {
  const token = await getDatabase().selectFrom('password_reset_tokens')
    .select('token_hash')
    .where('token_hash', '=', tokenHash)
    .where('consumed_at', 'is', null)
    .where('expires_at', '>', new Date())
    .executeTakeFirst();
  return Boolean(token);
}

/**
 * Consumes one valid token and changes its account's password atomically.
 * 1. Mark the token used only when it is unexpired and unused.
 * 2. Change the credential, rolling back if the account no longer has one.
 * 3. Consume all other reset links for the same account.
 */
export async function consumePasswordResetToken(
  tokenHash: string,
  passwordHash: string,
): Promise<string | null> {
  return getDatabase().transaction().execute(async (transaction) => {
    const now = new Date();

    // STEP 1: The conditional update allows only one concurrent use.
    const token = await transaction.updateTable('password_reset_tokens')
      .set({ consumed_at: now })
      .where('token_hash', '=', tokenHash)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', now)
      .returning('user_id')
      .executeTakeFirst();
    if (!token) return null;

    // STEP 2: Never consume a token without changing its password.
    const updated = await transaction.updateTable('user_passwords')
      .set({ password_hash: passwordHash })
      .where('user_id', '=', token.user_id)
      .executeTakeFirst();
    if (updated.numUpdatedRows !== BigInt(1)) {
      throw new Error('Password credential disappeared during reset.');
    }

    // STEP 3: A completed reset invalidates every other outstanding link.
    await transaction.updateTable('password_reset_tokens')
      .set({ consumed_at: now })
      .where('user_id', '=', token.user_id)
      .where('consumed_at', 'is', null)
      .execute();
    return token.user_id;
  });
}
