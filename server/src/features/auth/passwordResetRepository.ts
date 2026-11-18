import { getDatabase } from '@/lib/database';
import { matchesPasswordResetCode } from './passwordResetToken';

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
 * Stores a recovery code with a per-account send cooldown.
 * 1. Serialize requests for the account and check the cooldown.
 * 2. Invalidate previous codes and grants, then store the new code digest.
 */
export async function issuePasswordResetCode(
  userId: string,
  codeHash: string,
  salt: string,
  expiresAt: Date,
): Promise<boolean> {
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 1: Lock credentials so simultaneous sends cannot bypass the cooldown.
    const credential = await transaction.selectFrom('user_passwords')
      .select('user_id')
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!credential) return false;

    const recent = await transaction.selectFrom('password_reset_tokens')
      .select('token_hash')
      .where('user_id', '=', userId)
      .where('created_at', '>', new Date(Date.now() - 60_000))
      .executeTakeFirst();
    if (recent) return false;

    // STEP 2: A newly sent code replaces every earlier code or verified grant.
    await transaction.updateTable('password_reset_tokens')
      .set({ consumed_at: new Date() })
      .where('user_id', '=', userId)
      .where('consumed_at', 'is', null)
      .execute();
    await transaction.insertInto('password_reset_tokens')
      .values({
        token_hash: codeHash,
        user_id: userId,
        expires_at: expiresAt,
        consumed_at: null,
        code_salt: salt,
        verified_token_hash: null,
      })
      .execute();
    return true;
  });
}

/** Removes an unsent code when email delivery fails. */
export async function deletePasswordResetCode(codeHash: string): Promise<void> {
  await getDatabase().deleteFrom('password_reset_tokens')
    .where('token_hash', '=', codeHash)
    .execute();
}

/**
 * Exchanges a valid email code for a one-time password-change grant.
 * 1. Find the active code for the submitted account.
 * 2. Compare its keyed digest and replace it with the verified grant atomically.
 */
export async function verifyPasswordResetCode(
  email: string,
  code: string,
  secret: Buffer,
  grantHash: string,
  grantExpiresAt: Date,
): Promise<boolean> {
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 1: Lock the current code so concurrent verifications cannot both succeed.
    const activeCode = await transaction.selectFrom('password_reset_tokens as r')
      .innerJoin('user_emails as e', 'e.user_id', 'r.user_id')
      .select(['r.token_hash', 'r.code_salt'])
      .where('e.email', '=', email)
      .where('r.code_salt', 'is not', null)
      .where('r.consumed_at', 'is', null)
      .where('r.expires_at', '>', new Date())
      .orderBy('r.created_at', 'desc')
      .forUpdate()
      .executeTakeFirst();
    if (!activeCode?.code_salt ||
      !matchesPasswordResetCode(code, activeCode.code_salt, activeCode.token_hash, secret)) {
      return false;
    }

    // STEP 2: Discard the code salt and store only the hash of the new bearer grant.
    const updated = await transaction.updateTable('password_reset_tokens')
      .set({ code_salt: null, verified_token_hash: grantHash, expires_at: grantExpiresAt })
      .where('token_hash', '=', activeCode.token_hash)
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
    return updated.numUpdatedRows === BigInt(1);
  });
}

/** Checks grant validity before spending work hashing a new password. */
export async function hasActivePasswordResetGrant(grantHash: string): Promise<boolean> {
  const grant = await getDatabase().selectFrom('password_reset_tokens')
    .select('verified_token_hash')
    .where('verified_token_hash', '=', grantHash)
    .where('consumed_at', 'is', null)
    .where('expires_at', '>', new Date())
    .executeTakeFirst();
  return Boolean(grant);
}

/**
 * Spends a verified grant and changes the account's password atomically.
 * 1. Claim the unexpired grant once.
 * 2. Update the password or roll back the claim.
 * 3. Invalidate every other outstanding code or grant for that account.
 */
export async function consumePasswordResetGrant(
  grantHash: string,
  passwordHash: string,
): Promise<string | null> {
  return getDatabase().transaction().execute(async (transaction) => {
    const now = new Date();

    // STEP 1: The conditional update allows only one concurrent use.
    const grant = await transaction.updateTable('password_reset_tokens')
      .set({ consumed_at: now })
      .where('verified_token_hash', '=', grantHash)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', now)
      .returning('user_id')
      .executeTakeFirst();
    if (!grant) return null;

    // STEP 2: Never consume a grant without changing its password.
    const updated = await transaction.updateTable('user_passwords')
      .set({ password_hash: passwordHash })
      .where('user_id', '=', grant.user_id)
      .executeTakeFirst();
    if (updated.numUpdatedRows !== BigInt(1)) {
      throw new Error('Password credential disappeared during reset.');
    }

    // STEP 3: A completed reset invalidates every other outstanding code or grant.
    await transaction.updateTable('password_reset_tokens')
      .set({ consumed_at: now })
      .where('user_id', '=', grant.user_id)
      .where('consumed_at', 'is', null)
      .execute();
    return grant.user_id;
  });
}
