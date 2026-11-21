import { authCorsHeaders } from '@/features/auth/authCors';
import { expiredSessionCookie, getSessionUserId, invalidateSession, readSessionCookie } from '@/features/auth/sessionStore';
import { withApiRequestHistory } from '@/features/apiRequests/apiRequestHistory';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/**
 * Invalidates the supplied database session and clears only its session cookie.
 * 1. Check whether both cookies identify an active session for request history.
 * 2. Revoke the supplied session and clear its cookie, including when no session exists.
 * 3. Preserve the existing server error response if storage fails.
 */
async function handleLogout(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };
  try {
    // STEP 1: A validated session may be added to request history.
    await getSessionUserId(request);
    // STEP 2: Logout keeps its existing idempotent behavior.
    await invalidateSession(readSessionCookie(request));
    return new Response(null, {
      status: 204,
      headers: { ...headers, 'Set-Cookie': expiredSessionCookie(request) },
    });
  } catch (error) {
    // STEP 3: The route's error shape stays unchanged.
    console.error('Failed to sign out.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not sign you out right now.' } },
      { status: 500, headers },
    );
  }
}

/** Records the outcome of one logout request. */
export function POST(request: Request): Promise<Response> {
  return withApiRequestHistory(request, () => handleLogout(request));
}
