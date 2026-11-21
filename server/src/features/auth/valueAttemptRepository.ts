import { createHmac } from 'node:crypto';
import { sql } from 'kysely';
import { getDatabase } from '@/lib/database';
import { getPasswordResetCodeSecret } from './passwordResetToken';

export type ValueAttemptPolicy = {
  apiId: string;
  value: string;
  userId: string | null;
  count: number;
  blockDuration: number;
};
export type NewValueBlock = { apiId: string; value: string; userId: string; blockedAt: Date };
export type ValueAttemptOutcome = {
  retryAfterSeconds: number | null;
  blockAlreadyActive: boolean;
  newBlock: NewValueBlock | null;
};

/** Uses one account key across present and future sign-in identifiers. */
function valueDigest(identifier: string, userId: string | null): string {
  const subject = userId ? `user:${userId}` : `email:${identifier}`;
  return createHmac('sha256', getPasswordResetCodeSecret())
    .update('login-value:v1:').update(subject).digest('hex');
}

/** Loads the login value policy without persisting or exposing the identifier. */
export async function loadValueAttemptPolicy(email: string, userId: string | null): Promise<ValueAttemptPolicy | null> {
  const row = await getDatabase().selectFrom('apis as a')
    .innerJoin('api_restrictions as r', 'r.api_id', 'a.id')
    .select(['a.id as api_id', 'r.value_attemps'])
    .where('a.method', '=', 'POST')
    .where('a.path', '=', '/api/auth/login')
    .executeTakeFirst();
  const settings = row?.value_attemps;
  if (!row || !settings || typeof settings === 'number') return null;
  return {
    apiId: row.api_id,
    value: valueDigest(email, userId),
    userId,
    count: settings.count,
    blockDuration: settings.block_duration,
  };
}

/** Returns the remaining active block time, if any, without changing its expiry. */
export async function activeValueBlockSeconds(policy: ValueAttemptPolicy): Promise<number | null> {
  const row = await getDatabase().selectFrom('blocked_values')
    .select('blocked_until')
    .where('api_id', '=', policy.apiId)
    .where('value', '=', policy.value)
    .executeTakeFirst();
  if (!row) return null;
  const remaining = row.blocked_until.getTime() - Date.now();
  return remaining > 0 ? Math.max(1, Math.ceil(remaining / 1000)) : null;
}

/**
 * Finalizes one completed credential check and updates its value block atomically.
 * 1. Serialize outcomes for the same API and value.
 * 2. Store the final password result in the existing history row or a new row.
 * 3. Count failures since the latest success or expired block and create a block at the limit.
 */
export async function recordValueAttempt(
  policy: ValueAttemptPolicy,
  entry: { reservationId: string | null; ipId: string | null; deviceId: string | null; sessionId: string | null; status: 0 | 1 },
): Promise<ValueAttemptOutcome> {
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 1: One value's concurrent outcomes must not cross the threshold twice.
    const lockKey = `${policy.apiId}:value:${policy.value}`;
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`.execute(transaction);
    const now = new Date();
    const block = await transaction.selectFrom('blocked_values')
      .select('blocked_until')
      .where('api_id', '=', policy.apiId)
      .where('value', '=', policy.value)
      .executeTakeFirst();

    if (block && block.blocked_until > now) {
      // NOTE: A concurrent request may have blocked this value after the route's first check.
      if (entry.reservationId) {
        await transaction.updateTable('api_request_history')
          .set({ ip_id: entry.ipId, device_id: entry.deviceId, session_id: entry.sessionId, status: 0, value: null })
          .where('id', '=', entry.reservationId)
          .executeTakeFirstOrThrow();
      } else {
        await transaction.insertInto('api_request_history')
          .values({ api_id: policy.apiId, ip_id: entry.ipId, device_id: entry.deviceId,
            session_id: entry.sessionId, status: 0 })
          .execute();
      }
      return { retryAfterSeconds: Math.max(1, Math.ceil((block.blocked_until.getTime() - now.getTime()) / 1000)),
        blockAlreadyActive: true, newBlock: null };
    }

    // STEP 2: Record a value only when a password check has finished.
    if (entry.reservationId) {
      await transaction.updateTable('api_request_history')
        .set({ ip_id: entry.ipId, device_id: entry.deviceId, session_id: entry.sessionId,
          status: entry.status, value: policy.value })
        .where('id', '=', entry.reservationId)
        .executeTakeFirstOrThrow();
    } else {
      await transaction.insertInto('api_request_history')
        .values({ api_id: policy.apiId, ip_id: entry.ipId, device_id: entry.deviceId,
          session_id: entry.sessionId, status: entry.status, value: policy.value })
        .execute();
    }
    if (entry.status === 1) return { retryAfterSeconds: null, blockAlreadyActive: false, newBlock: null };

    // STEP 3: An expired block and a successful password check each reset the cycle.
    const latestSuccess = await transaction.selectFrom('api_request_history')
      .select('created_at')
      .where('api_id', '=', policy.apiId)
      .where('value', '=', policy.value)
      .where('status', '=', 1)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    const cutoff = Math.max(latestSuccess?.created_at.getTime() ?? 0,
      block && block.blocked_until <= now ? block.blocked_until.getTime() : 0);
    const failures = await transaction.selectFrom('api_request_history')
      .select(sql<string>`count(*)`.as('count'))
      .where('api_id', '=', policy.apiId)
      .where('value', '=', policy.value)
      .where('status', '=', 0)
      .where('created_at', '>', new Date(cutoff))
      .executeTakeFirstOrThrow();
    if (Number(failures.count) < policy.count) {
      return { retryAfterSeconds: null, blockAlreadyActive: false, newBlock: null };
    }
    await transaction.insertInto('blocked_values')
      .values({ api_id: policy.apiId, value: policy.value, user_id: policy.userId,
        blocked_at: now, blocked_until: new Date(now.getTime() + policy.blockDuration * 1000) })
      .onConflict((conflict) => conflict.columns(['api_id', 'value']).doUpdateSet({
        user_id: policy.userId, blocked_at: now,
        blocked_until: new Date(now.getTime() + policy.blockDuration * 1000), notified_at: null,
      }))
      .execute();
    return {
      retryAfterSeconds: policy.blockDuration,
      blockAlreadyActive: false,
      newBlock: policy.userId
        ? { apiId: policy.apiId, value: policy.value, userId: policy.userId, blockedAt: now }
        : null,
    };
  });
}

/** Finds one registered email only while the newly created block is still current. */
export async function findBlockNotificationEmail(block: NewValueBlock): Promise<string | null> {
  const row = await getDatabase().selectFrom('blocked_values as b')
    .innerJoin('user_emails as e', 'e.user_id', 'b.user_id')
    .select('e.email')
    .where('b.api_id', '=', block.apiId)
    .where('b.value', '=', block.value)
    .where('b.user_id', '=', block.userId)
    .where('b.blocked_at', '=', block.blockedAt)
    .where('b.notified_at', 'is', null)
    .orderBy('e.created_at', 'asc')
    .orderBy('e.id', 'asc')
    .executeTakeFirst();
  return row?.email ?? null;
}

/** Marks delivery only for the same block cycle after SMTP accepts the message. */
export async function markValueBlockNotified(block: NewValueBlock): Promise<void> {
  await getDatabase().updateTable('blocked_values')
    .set({ notified_at: new Date() })
    .where('api_id', '=', block.apiId)
    .where('value', '=', block.value)
    .where('user_id', '=', block.userId)
    .where('blocked_at', '=', block.blockedAt)
    .where('notified_at', 'is', null)
    .execute();
}
