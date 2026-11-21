import { trustedClientIp } from '@/features/auth/clientIp';
import { requestDeviceTokenHash } from '@/features/auth/deviceStore';
import { getRequestIdentity, noteRequestReservation } from './apiRequestHistory';
import { reserveRestrictedRequest } from './apiRestrictionRepository';

/**
 * Enforces a configured route policy after proof or session validation.
 * 1. Read only identifiers established by this request or a known device cookie.
 * 2. Atomically check all configured subjects and reserve the attempt.
 * 3. Return a standard 429 or retryable service error when processing cannot continue.
 */
export async function enforceApiRestriction(
  request: Request,
  headers: Record<string, string>,
): Promise<Response | null> {
  // STEP 1: Anonymous requests cannot reach this check before proof succeeds.
  const identity = getRequestIdentity();
  if (!identity?.verificationPassed && !identity?.sessionId) return null;

  try {
    // STEP 2: The transaction serializes concurrent checks before the handler continues.
    const result = await reserveRestrictedRequest({
      method: request.method.toUpperCase(),
      path: new URL(request.url).pathname,
      ipAddress: trustedClientIp(request),
      deviceTokenHash: requestDeviceTokenHash(request),
      ipId: identity.ipId,
      deviceId: identity.deviceId,
      sessionId: identity.sessionId,
    });
    if (result.kind === 'unrestricted') return null;
    noteRequestReservation(result.reservationId, result.ipId, result.deviceId);
    if (result.kind === 'allowed') return null;

    // STEP 3: A blocked attempt remains in history and counts within the window.
    return Response.json(
      { error: { code: 'TOO_MANY_REQUESTS', message: 'Please wait before trying again.' } },
      { status: 429, headers: { ...headers, 'Retry-After': String(result.retryAfterSeconds) } },
    );
  } catch (error) {
    console.error('Failed to check API request limits.', error);
    return Response.json(
      { error: { code: 'RESTRICTION_UNAVAILABLE', message: 'Please try again shortly.' } },
      { status: 503, headers },
    );
  }
}
