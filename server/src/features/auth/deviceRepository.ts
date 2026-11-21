import { sql, type Transaction } from 'kysely';
import { getDatabase, type DatabaseTables } from '@/lib/database';
import { deviceLifetimeSeconds } from './authLifetime';

type PlatformCode = DatabaseTables['platforms']['code'];
type DeviceMetadata = { platform: PlatformCode; osVersion: string | null; model: string | null };
type DeviceRegistration = DeviceMetadata & { tokenHash: string; ipAddress: string | null };

const newDevicesPerIpPerHour = 30;

export class DeviceIssueLimitError extends Error {}

/** Finds the internal device ID for a server-issued token digest. */
export async function findDeviceByTokenHash(tokenHash: string): Promise<string | null> {
  const row = await getDatabase().selectFrom('devices')
    .select('id')
    .where('device_token_hash', '=', tokenHash)
    .where('last_seen_at', '>', new Date(Date.now() - deviceLifetimeSeconds * 1000))
    .executeTakeFirst();
  return row?.id ?? null;
}

/** Upserts a trusted observed IP within the surrounding device transaction. */
async function recordIp(transaction: Transaction<DatabaseTables>, address: string | null, now: Date): Promise<string | null> {
  if (!address) return null;
  const row = await transaction.insertInto('ips')
    .values({ address, last_seen_at: now })
    .onConflict((conflict) => conflict.column('address').doUpdateSet({ last_seen_at: now }))
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Records a device-IP association once and refreshes its last-seen time later. */
async function recordDeviceIp(transaction: Transaction<DatabaseTables>, deviceId: string, ipId: string | null, now: Date): Promise<void> {
  if (!ipId) return;
  await transaction.insertInto('ip_devices')
    .values({ device_id: deviceId, ip_id: ipId, last_seen_at: now })
    .onConflict((conflict) => conflict.columns(['device_id', 'ip_id']).doUpdateSet({ last_seen_at: now }))
    .execute();
}

/** Finds the seeded platform ID before storing client-provided device metadata. */
async function findPlatformId(transaction: Transaction<DatabaseTables>, code: PlatformCode): Promise<number> {
  const row = await transaction.selectFrom('platforms').select('id').where('code', '=', code).executeTakeFirstOrThrow();
  return row.id;
}

/**
 * Creates a device and its first IP association in one transaction.
 * 1. Lock the IP row and bound new anonymous devices sharing that IP.
 * 2. Insert the device with a seeded platform and hashed token.
 * 3. Link the IP to the device before committing.
 */
export async function createDevice(input: DeviceRegistration): Promise<{ id: string; ipId: string | null }> {
  return getDatabase().transaction().execute(async (transaction) => {
    const now = new Date();
    // STEP 1: An IP upsert serializes concurrent registrations from the same address.
    const ipId = await recordIp(transaction, input.ipAddress, now);
    if (ipId) {
      const recent = await transaction.selectFrom('ip_devices as link')
        .innerJoin('devices as device', 'device.id', 'link.device_id')
        .select(sql<string>`count(*)`.as('count'))
        .where('link.ip_id', '=', ipId)
        .where('device.created_at', '>', new Date(now.getTime() - 60 * 60 * 1000))
        .executeTakeFirstOrThrow();
      if (Number(recent.count) >= newDevicesPerIpPerHour) throw new DeviceIssueLimitError();
    }

    // STEP 2: Keep raw device tokens out of the database.
    const platformId = await findPlatformId(transaction, input.platform);
    const device = await transaction.insertInto('devices')
      .values({
        device_token_hash: input.tokenHash,
        platform_id: platformId,
        os_version: input.osVersion,
        model: input.model,
        last_seen_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // STEP 3: A failed association rolls back the new device too.
    await recordDeviceIp(transaction, device.id, ipId, now);
    return { id: device.id, ipId };
  });
}

/**
 * Updates existing device metadata and its observed IP together.
 * 1. Resolve the current platform and optional IP.
 * 2. Update metadata and the device-IP association without extending device validity.
 */
export async function touchDevice(
  id: string,
  metadata: DeviceMetadata,
  ipAddress: string | null,
): Promise<string | null> {
  return getDatabase().transaction().execute(async (transaction) => {
    // STEP 1: Use the latest available platform metadata and trusted IP.
    const now = new Date();
    const platformId = await findPlatformId(transaction, metadata.platform);
    const ipId = await recordIp(transaction, ipAddress, now);

    // STEP 2: Missing optional metadata does not erase an earlier known value.
    await transaction.updateTable('devices')
      .set({
        platform_id: platformId,
        ...(metadata.osVersion ? { os_version: metadata.osVersion } : {}),
        ...(metadata.model ? { model: metadata.model } : {}),
      })
      .where('id', '=', id)
      .execute();
    await recordDeviceIp(transaction, id, ipId, now);
    return ipId;
  });
}
