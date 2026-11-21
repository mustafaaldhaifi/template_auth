import { appendAuthCookie, authCookie, readAuthCookie } from './authCookies';
import { createDevice, findDeviceByTokenHash, touchDevice } from './deviceRepository';
import { hashOpaqueToken, isOpaqueToken, newOpaqueToken } from './authTokens';
import { trustedClientIp } from './clientIp';
import { noteRequestDevice } from '@/features/apiRequests/apiRequestHistory';

const deviceCookieName = 'auth_device';
const deviceLifetimeSeconds = 60 * 60 * 24 * 180;
type PlatformCode = 'ios' | 'android' | 'web';
export type DeviceIdentity = { id: string; ipId: string | null; cookie: string | null };

/** Treats client device details as descriptive metadata rather than authentication proof. */
function deviceMetadata(request: Request): { platform: PlatformCode; osVersion: string | null; model: string | null } {
  const supplied = request.headers.get('x-client-platform');
  const userAgent = request.headers.get('user-agent') ?? '';
  const platform: PlatformCode = supplied === 'ios' || supplied === 'android' || supplied === 'web'
    ? supplied
    : /android|okhttp/i.test(userAgent) ? 'android'
      : /iphone|ipad|cfnetwork/i.test(userAgent) ? 'ios' : 'web';
  const optionalValue = (value: string | null) => value && value.trim().length <= 120 ? value.trim() || null : null;
  return {
    platform,
    osVersion: optionalValue(request.headers.get('x-client-os-version')),
    model: optionalValue(request.headers.get('x-client-model')),
  };
}

/** Returns the SHA-256 digest only when the request carries a server-issued device-shaped cookie. */
export function requestDeviceTokenHash(request: Request): string | null {
  const token = readAuthCookie(request, deviceCookieName);
  return isOpaqueToken(token) ? hashOpaqueToken(token) : null;
}

/**
 * Reuses a known device or issues one on the first valid authentication request.
 * 1. Look up the incoming opaque cookie without treating its metadata as proof.
 * 2. Refresh the existing device and IP link, or atomically register a new device.
 * 3. Note the persisted IDs for request history and issue a cookie only for a new token.
 */
export async function resolveOrCreateDevice(request: Request): Promise<DeviceIdentity> {
  // STEP 1: A missing or invalid cookie cannot identify an existing device.
  const tokenHash = requestDeviceTokenHash(request);
  const metadata = deviceMetadata(request);
  const ipAddress = trustedClientIp(request);
  const knownId = tokenHash ? await findDeviceByTokenHash(tokenHash) : null;

  // STEP 2: Keep the same device record for subsequent authentication attempts.
  if (knownId) {
    const ipId = await touchDevice(knownId, metadata, ipAddress);
    noteRequestDevice(knownId, ipId);
    return { id: knownId, ipId, cookie: null };
  }
  const token = newOpaqueToken();
  const device = await createDevice({ ...metadata, tokenHash: hashOpaqueToken(token), ipAddress });
  noteRequestDevice(device.id, device.ipId);

  // STEP 3: Only the response receives the raw token.
  return { id: device.id, ipId: device.ipId, cookie: authCookie(deviceCookieName, token, deviceLifetimeSeconds, request) };
}

/** Adds a newly issued device cookie to any successful or failed auth response. */
export function withDeviceCookie(response: Response, identity: DeviceIdentity | null): Response {
  return appendAuthCookie(response, identity?.cookie ?? null);
}
