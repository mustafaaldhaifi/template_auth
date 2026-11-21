import { AsyncLocalStorage } from 'node:async_hooks';
import { trustedClientIp } from '@/features/auth/clientIp';
import { recordValueAttempt, type ValueAttemptOutcome, type ValueAttemptPolicy } from '@/features/auth/valueAttemptRepository';
import { completeReservedRequest, insertRequestHistory } from './apiRequestHistoryRepository';

type RequestIdentity = {
  ipId: string | null;
  deviceId: string | null;
  sessionId: string | null;
  reservationId: string | null;
  verificationPassed: boolean;
  valuePolicy: ValueAttemptPolicy | null;
};

const requestIdentity = new AsyncLocalStorage<RequestIdentity>();

/** Allows a protected auth request to be recorded only after its proof succeeds. */
export function markRequestVerificationPassed(): void {
  const identity = requestIdentity.getStore();
  if (identity) identity.verificationPassed = true;
}

/** Marks a completed login password check for value-based history and blocking. */
export function noteRequestValue(policy: ValueAttemptPolicy): void {
  const identity = requestIdentity.getStore();
  if (identity) identity.valuePolicy = policy;
}

/** Adds a verified or reused device to the current request's audit context. */
export function noteRequestDevice(deviceId: string, ipId: string | null): void {
  const identity = requestIdentity.getStore();
  if (identity) {
    identity.deviceId = deviceId;
    identity.ipId = ipId;
  }
}

/** Adds a persisted session only after the route has resolved or created it. */
export function noteRequestSession(sessionId: string): void {
  const identity = requestIdentity.getStore();
  if (identity) identity.sessionId = sessionId;
}

/** Exposes only already validated identifiers to the route-limit check. */
export function getRequestIdentity(): Pick<RequestIdentity, 'ipId' | 'deviceId' | 'sessionId' | 'verificationPassed'> | null {
  return requestIdentity.getStore() ?? null;
}

/** Associates one atomic rate-limit reservation with the active request. */
export function noteRequestReservation(id: string, ipId: string | null, deviceId: string | null): void {
  const identity = requestIdentity.getStore();
  if (!identity) return;
  identity.reservationId = id;
  identity.ipId = ipId;
  identity.deviceId = deviceId;
}

/**
 * Persists one outcome without replacing the route's original response or error.
 * 1. Skip requests without a successful proof or validated session.
 * 2. Finalize completed password checks with their value policy in one transaction.
 * 3. Otherwise record the API ID, available identities, and response status.
 * 4. Log ordinary audit failures while preserving the endpoint outcome.
 */
async function recordOutcome(request: Request, status: number, identity: RequestIdentity): Promise<ValueAttemptOutcome | null> {
  try {
    // STEP 1: Unverified anonymous requests must leave no history row.
    if (!identity.verificationPassed && !identity.sessionId) return null;

    // STEP 2: A completed credential check has an atomic audit and block update.
    if (identity.valuePolicy) {
      // NOTE: A value attempt and its block must commit together; failures cannot be ignored.
      return await recordValueAttempt(identity.valuePolicy, {
        reservationId: identity.reservationId,
        ipId: identity.ipId,
        deviceId: identity.deviceId,
        sessionId: identity.sessionId,
        status: status >= 200 && status < 300 ? 1 : 0,
      });
    }

    // STEP 3: Persist only identifiers already established by the handler.
    const path = new URL(request.url).pathname;
    const entry = {
      method: request.method.toUpperCase(),
      path,
      ipId: identity.ipId,
      ipAddress: trustedClientIp(request),
      deviceId: identity.deviceId,
      sessionId: identity.sessionId,
      status: status >= 200 && status < 300 ? 1 as const : 0 as const,
    };
    if (identity.reservationId) {
      await completeReservedRequest(identity.reservationId, entry);
    } else {
      await insertRequestHistory(entry);
    }
  } catch (error) {
    if (identity.valuePolicy) throw error;
    // STEP 4: Ordinary audit storage cannot change an already completed API result.
    console.error('Failed to record an API request.', error);
  }
  return null;
}

/**
 * Records each eligible API request once while keeping route behavior intact.
 * 1. Create an isolated context for identifiers learned during the request.
 * 2. Run the original handler and capture its response or unhandled failure.
 * 3. Store one success or failure row for verified requests before returning the original outcome.
 */
export function withApiRequestHistory(request: Request, handler: () => Response | Promise<Response>): Promise<Response> {
  // STEP 1: Keep identifiers isolated across concurrent requests.
  const identity: RequestIdentity = {
    ipId: null,
    deviceId: null,
    sessionId: null,
    reservationId: null,
    verificationPassed: false,
    valuePolicy: null,
  };
  return requestIdentity.run(identity, async () => {
    // STEP 2: Run the existing route inside its own request context.
    let response: Response;
    try {
      response = await handler();
    } catch (error) {
      // STEP 3: An unhandled exception becomes a server error in Next.js.
      await recordOutcome(request, 500, identity);
      throw error;
    }

    // STEP 3: Use the actual response status, including early returns.
    let valueOutcome: ValueAttemptOutcome | null;
    try {
      valueOutcome = await recordOutcome(request, response.status, identity);
    } catch (error) {
      console.error('Failed to record a login value attempt.', error);
      const headers = new Headers(response.headers);
      headers.delete('Set-Cookie');
      return Response.json({ error: { code: 'RESTRICTION_UNAVAILABLE', message: 'Please try again shortly.' } },
        { status: 503, headers });
    }
    if (valueOutcome?.retryAfterSeconds != null) {
      const headers = new Headers(response.headers);
      if (valueOutcome.blockAlreadyActive) headers.delete('Set-Cookie');
      headers.set('Retry-After', String(valueOutcome.retryAfterSeconds));
      return Response.json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Please wait before trying again.' } },
        { status: 429, headers });
    }
    return response;
  });
}
