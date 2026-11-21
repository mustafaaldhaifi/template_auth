import { getDatabase } from '@/lib/database';

export type RequestHistoryEntry = {
  method: string;
  path: string;
  ipId: string | null;
  ipAddress: string | null;
  deviceId: string | null;
  sessionId: string | null;
  status: 0 | 1;
};

/** Finds an already known IP without creating records for unverified requests. */
async function findKnownIpId(address: string | null): Promise<string | null> {
  if (!address) return null;
  const row = await getDatabase().selectFrom('ips')
    .select('id')
    .where('address', '=', address)
    .executeTakeFirst();
  return row?.id ?? null;
}

/**
 * Inserts one request outcome using the stable API catalog ID.
 * 1. Find the seeded method and path pair.
 * 2. Resolve an already observed IP if the handler did not supply its ID.
 * 3. Insert one success or failure row with nullable identifiers.
 */
export async function insertRequestHistory(entry: RequestHistoryEntry): Promise<void> {
  const database = getDatabase();
  // STEP 1: The catalog ID must already exist in the approved migration.
  const api = await database.selectFrom('apis')
    .select('id')
    .where('method', '=', entry.method)
    .where('path', '=', entry.path)
    .executeTakeFirstOrThrow();
  // STEP 2: Never create an IP record only for a rejected request.
  const ipId = entry.ipId ?? await findKnownIpId(entry.ipAddress);
  // STEP 3: A single insert captures the final response status.
  await database.insertInto('api_request_history')
    .values({
      api_id: api.id,
      ip_id: ipId,
      device_id: entry.deviceId,
      session_id: entry.sessionId,
      status: entry.status,
    })
    .execute();
}
