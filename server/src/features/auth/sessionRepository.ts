import type { Transaction } from 'kysely';
import { getDatabase, type DatabaseTables } from '@/lib/database';

/** Persists a device-bound session digest and returns its audit ID. */
export async function insertSession(
  tokenHash: string,
  userId: string,
  deviceId: string,
  loginIpId: string | null,
  expiresAt: Date,
): Promise<string> {
  const row = await getDatabase().insertInto('auth_sessions')
    .values({
      token_hash: tokenHash,
      user_id: userId,
      device_id: deviceId,
      login_ip_id: loginIpId,
      expires_at: expiresAt,
      revoked_at: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Resolves an active session and its audit IDs only when both cookies agree. */
export async function findActiveSessionUserId(
  tokenHash: string,
  deviceTokenHash: string,
): Promise<{ userId: string; sessionId: string; deviceId: string } | null> {
  const row = await getDatabase().selectFrom('auth_sessions as session')
    .innerJoin('devices as device', 'device.id', 'session.device_id')
    .select(['session.user_id', 'session.id', 'session.device_id'])
    .where('session.token_hash', '=', tokenHash)
    .where('device.device_token_hash', '=', deviceTokenHash)
    .where('session.revoked_at', 'is', null)
    .where('session.expires_at', '>', new Date())
    .executeTakeFirst();
  return row ? { userId: row.user_id, sessionId: row.id, deviceId: row.device_id } : null;
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
