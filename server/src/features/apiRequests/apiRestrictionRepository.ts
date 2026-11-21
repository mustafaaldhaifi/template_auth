import { sql, type Transaction } from 'kysely';
import { getDatabase, type DatabaseTables } from '@/lib/database';

type LimitItem = 'ip' | 'device' | 'session';
type LimitTarget = { item: LimitItem; column: 'ip_id' | 'device_id' | 'session_id'; id: string };

export type RestrictionInput = {
  method: string;
  path: string;
  ipAddress: string | null;
  deviceTokenHash: string | null;
  ipId: string | null;
  deviceId: string | null;
  sessionId: string | null;
};

export type RestrictionResult =
  | { kind: 'unrestricted' }
  | { kind: 'allowed' | 'blocked'; reservationId: string; ipId: string | null; deviceId: string | null; retryAfterSeconds: number };

/** Finds or creates an IP only after the caller has passed proof or session checks. */
async function resolveIpId(
  transaction: Transaction<DatabaseTables>,
  address: string | null,
  knownId: string | null,
): Promise<string | null> {
  if (knownId || !address) return knownId;
  const row = await transaction.insertInto('ips')
    .values({ address, last_seen_at: new Date() })
    .onConflict((conflict) => conflict.column('address').doUpdateSet({ last_seen_at: new Date() }))
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Resolves a previously issued device token without creating a new device. */
async function resolveDeviceId(
  transaction: Transaction<DatabaseTables>,
  tokenHash: string | null,
  knownId: string | null,
): Promise<string | null> {
  if (knownId || !tokenHash) return knownId;
  const row = await transaction.selectFrom('devices')
    .select('id')
    .where('device_token_hash', '=', tokenHash)
    .executeTakeFirst();
  return row?.id ?? null;
}

/** Builds only the policy subjects that have a verified server-side ID. */
function activeTargets(items: LimitItem[], ipId: string | null, deviceId: string | null, sessionId: string | null): LimitTarget[] {
  const targets: LimitTarget[] = [];
  if (items.includes('ip') && ipId) targets.push({ item: 'ip', column: 'ip_id', id: ipId });
  if (items.includes('device') && deviceId) targets.push({ item: 'device', column: 'device_id', id: deviceId });
  if (items.includes('session') && sessionId) targets.push({ item: 'session', column: 'session_id', id: sessionId });
  return targets;
}

/** Serializes concurrent checks on the same API and subject until reservation commits. */
async function lockTargets(transaction: Transaction<DatabaseTables>, apiId: string, targets: LimitTarget[]): Promise<void> {
  const keys = targets.map(({ item, id }) => `${apiId}:${item}:${id}`).sort();
  for (const key of keys) {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(transaction);
  }
}

/** Counts all prior eligible attempts, including failures and blocked requests. */
async function countRecentAttempts(
  transaction: Transaction<DatabaseTables>,
  apiId: string,
  target: LimitTarget,
  since: Date,
): Promise<number> {
  const row = await transaction.selectFrom('api_request_history')
    .select(sql<string>`count(*)`.as('attempts'))
    .where('api_id', '=', apiId)
    .where(target.column, '=', target.id)
    .where('created_at', '>', since)
    .executeTakeFirstOrThrow();
  return Number(row.attempts);
}

/** Finds when enough counted attempts will leave the rolling window. */
async function secondsUntilAvailable(
  transaction: Transaction<DatabaseTables>,
  apiId: string,
  target: LimitTarget,
  since: Date,
  minutes: number,
  attempts: number,
  maximum: number,
  now: Date,
): Promise<number> {
  const row = await transaction.selectFrom('api_request_history')
    .select('created_at')
    .where('api_id', '=', apiId)
    .where(target.column, '=', target.id)
    .where('created_at', '>', since)
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')
    .offset(attempts - maximum)
    .limit(1)
    .executeTakeFirstOrThrow();
  return Math.max(1, Math.ceil((row.created_at.getTime() + minutes * 60_000 - now.getTime()) / 1000));
}

/**
 * Checks minute-based policy windows and reserves one attempt atomically.
 * 1. Load the policy for the existing method and path.
 * 2. Resolve available IDs and lock each configured subject in stable order.
 * 3. Reject when any subject exceeds any window, then reserve one history row.
 */
export async function reserveRestrictedRequest(input: RestrictionInput): Promise<RestrictionResult> {
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 1: A route without a policy keeps the normal post-response history write.
    const api = await transaction.selectFrom('apis')
      .select('id')
      .where('method', '=', input.method)
      .where('path', '=', input.path)
      .executeTakeFirstOrThrow();
    const restriction = await transaction.selectFrom('api_restrictions')
      .select(['policy', 'items'])
      .where('api_id', '=', api.id)
      .executeTakeFirst();
    if (!restriction) return { kind: 'unrestricted' };

    // STEP 2: Missing identifiers are skipped, including sessions before login.
    const ipId = restriction.items.includes('ip')
      ? await resolveIpId(transaction, input.ipAddress, input.ipId) : input.ipId;
    const deviceId = restriction.items.includes('device')
      ? await resolveDeviceId(transaction, input.deviceTokenHash, input.deviceId) : input.deviceId;
    const targets = activeTargets(restriction.items, ipId, deviceId, input.sessionId);
    if (targets.length === 0) return { kind: 'unrestricted' };
    await lockTargets(transaction, api.id, targets);

    // STEP 3: Every window applies independently to every available subject.
    const now = new Date();
    let retryAfterSeconds = 0;
    for (const [minuteText, maximum] of Object.entries(restriction.policy)) {
      const minutes = Number(minuteText);
      const since = new Date(now.getTime() - minutes * 60_000);
      for (const target of targets) {
        const attempts = await countRecentAttempts(transaction, api.id, target, since);
        if (attempts >= maximum) {
          const seconds = await secondsUntilAvailable(transaction, api.id, target, since, minutes, attempts, maximum, now);
          retryAfterSeconds = Math.max(retryAfterSeconds, seconds);
        }
      }
    }
    const row = await transaction.insertInto('api_request_history')
      .values({
        api_id: api.id,
        ip_id: ipId,
        device_id: deviceId,
        session_id: input.sessionId,
        status: 0,
        created_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return {
      kind: retryAfterSeconds > 0 ? 'blocked' : 'allowed',
      reservationId: row.id,
      ipId,
      deviceId,
      retryAfterSeconds,
    };
  });
}
