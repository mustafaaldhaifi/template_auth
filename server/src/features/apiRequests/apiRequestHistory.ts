import { AsyncLocalStorage } from 'node:async_hooks';
import { trustedClientIp } from '@/features/auth/clientIp';
import { insertRequestHistory } from './apiRequestHistoryRepository';

type RequestIdentity = {
  ipId: string | null;
  deviceId: string | null;
  sessionId: string | null;
  verificationPassed: boolean;
};

const requestIdentity = new AsyncLocalStorage<RequestIdentity>();

/** Allows a protected auth request to be recorded only after its proof succeeds. */
export function markRequestVerificationPassed(): void {
  const identity = requestIdentity.getStore();
  if (identity) identity.verificationPassed = true;
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

/**
 * Persists one outcome without replacing the route's original response or error.
 * 1. Skip requests without a successful proof or validated session.
 * 2. Record the API ID, available identities, and response status.
 * 3. Log an audit failure while preserving the endpoint outcome.
 */
async function recordOutcome(request: Request, status: number, identity: RequestIdentity): Promise<void> {
  try {
    // STEP 1: Unverified anonymous requests must leave no history row.
    if (!identity.verificationPassed && !identity.sessionId) return;

    // STEP 2: Persist only identifiers already established by the handler.
    const path = new URL(request.url).pathname;
    await insertRequestHistory({
      method: request.method.toUpperCase(),
      path,
      ipId: identity.ipId,
      ipAddress: trustedClientIp(request),
      deviceId: identity.deviceId,
      sessionId: identity.sessionId,
      status: status >= 200 && status < 300 ? 1 : 0,
    });
  } catch (error) {
    // STEP 3: Audit storage cannot change an already completed API result.
    console.error('Failed to record an API request.', error);
  }
}

/**
 * Records each eligible API request once while keeping route behavior intact.
 * 1. Create an isolated context for identifiers learned during the request.
 * 2. Run the original handler and capture its response or unhandled failure.
 * 3. Store one success or failure row for verified requests before returning the original outcome.
 */
export function withApiRequestHistory(request: Request, handler: () => Response | Promise<Response>): Promise<Response> {
  // STEP 1: Keep identifiers isolated across concurrent requests.
  const identity: RequestIdentity = { ipId: null, deviceId: null, sessionId: null, verificationPassed: false };
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
    await recordOutcome(request, response.status, identity);
    return response;
  });
}
