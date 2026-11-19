import type { Transaction } from 'kysely';
import { getDatabase, type DatabaseTables } from '@/lib/database';

/** Persists the digest of a new device-bound session. */
export async function insertSession(
  tokenHash: string,
  userId: string,
  deviceId: string,
  loginIpId: string | null,
  expiresAt: Date,
): Promise<void> {
  await getDatabase().insertInto('auth_sessions')
    .values({
      token_hash: tokenHash,
      user_id: userId,
      device_id: deviceId,
      login_ip_id: loginIpId,
      expires_at: expiresAt,
      revoked_at: null,
    })
    .execute();
}

/** Resolves a session only when its token, device, expiry, and revocation all agree. */
export async function findActiveSessionUserId(tokenHash: string, deviceTokenHash: string): Promise<string | null> {
  const row = await getDatabase().selectFrom('auth_sessions as session')
    .innerJoin('devices as device', 'device.id', 'session.device_id')
    .select('session.user_id')
    .where('session.token_hash', '=', tokenHash)
    .where('device.device_token_hash', '=', deviceTokenHash)
    .where('session.revoked_at', 'is', null)
    .where('session.expires_at', '>', new Date())
    .executeTakeFirst();
  return row?.user_id ?? null;
}

/** Ends one session without deleting its audit row. */
export async function revokeSession(tokenHash: string): Promise<void> {
  await getDatabase().updateTable('auth_sessions')
    .set({ revoked_at: new Date() })
    .where('token_hash', '=', tokenHash)
    .where('revoked_at', 'is', null)
    .execute();
}

/** Ends all account sessions inside the caller's password-change transaction. */
export async function revokeUserSessionsInTransaction(
  transaction: Transaction<DatabaseTables>,
  userId: string,
  now: Date,
): Promise<void> {
  await transaction.updateTable('auth_sessions')
    .set({ revoked_at: now })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();
}
