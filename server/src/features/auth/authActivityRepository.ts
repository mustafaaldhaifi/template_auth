import { getDatabase } from '@/lib/database';
import { deviceLifetimeSeconds, sessionLifetimeSeconds } from './authLifetime';

type RenewedActivity = { device: boolean; session: boolean };

/**
 * Extends valid device and session activity after a successful response.
 * 1. Reject a missing or inactive device without updating either record.
 * 2. Extend a still-active, unrevoked session bound to that device when requested.
 * 3. Commit both changes together before refreshed cookies are returned.
 */
export async function renewAuthActivity(
  deviceTokenHash: string,
  sessionTokenHash: string | null,
): Promise<RenewedActivity> {
  return getDatabase().transaction().execute(async (transaction) => {
    const now = new Date();
    // STEP 1: A stale device token must never regain validity through a successful public request.
    const device = await transaction.updateTable('devices')
      .set({ last_seen_at: now })
      .where('device_token_hash', '=', deviceTokenHash)
      .where('last_seen_at', '>', new Date(now.getTime() - deviceLifetimeSeconds * 1000))
      .returning('id')
      .executeTakeFirst();
    if (!device) return { device: false, session: false };

    // STEP 2: Only a live session for this device receives a new expiry.
    let session = false;
    if (sessionTokenHash) {
      const updated = await transaction.updateTable('auth_sessions')
        .set({ expires_at: new Date(now.getTime() + sessionLifetimeSeconds * 1000) })
        .where('token_hash', '=', sessionTokenHash)
        .where('device_id', '=', device.id)
        .where('revoked_at', 'is', null)
        .where('expires_at', '>', now)
        .returning('id')
        .executeTakeFirst();
      session = Boolean(updated);
    }

    // STEP 3: The caller sends cookies only after the transaction commits.
    return { device: true, session };
  });
}
