import { authCorsHeaders } from '@/features/auth/authCors';
import { expiredSessionCookie, getSessionUserId, invalidateSession, readSessionCookie } from '@/features/auth/sessionStore';
import { withApiRequestHistory } from '@/features/apiRequests/apiRequestHistory';
import { enforceApiRestriction } from '@/features/apiRequests/enforceApiRestriction';
import { withAuthCookieRenewal } from '@/features/auth/authCookieRenewal';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/**
 * Invalidates the supplied database session and clears only its session cookie.
 * 1. Check whether both cookies identify an active session for request history.
 * 2. Enforce configured limits for a validated session.
 * 3. Revoke the supplied session and clear its cookie, including when no session exists.
 * 4. Preserve the existing server error response if storage fails.
 */
async function handleLogout(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };
  try {
    // STEP 1: A validated session may be added to request history.
    await getSessionUserId(request);
    // STEP 2: Only validated sessions are subject to a configured route limit.
    const restriction = await enforceApiRestriction(request, headers);
    if (restriction) return restriction;
    // STEP 3: Logout keeps its existing idempotent behavior.
    await invalidateSession(readSessionCookie(request));
    return new Response(null, {
      status: 204,
      headers: { ...headers, 'Set-Cookie': expiredSessionCookie(request) },
    });
  } catch (error) {
    // STEP 4: The route's error shape stays unchanged.
    console.error('Failed to sign out.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not sign you out right now.' } },
      { status: 500, headers },
    );
  }
}

/** Renews the device when eligible and records the outcome of one logout request. */
export function POST(request: Request): Promise<Response> {
  return withApiRequestHistory(request, () => withAuthCookieRenewal(request, () => handleLogout(request)));
}
