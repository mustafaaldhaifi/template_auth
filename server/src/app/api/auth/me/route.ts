import { authCorsHeaders } from '@/features/auth/authCors';
import { findCurrentUser } from '@/features/auth/currentUserRepository';
import { getSessionUserId } from '@/features/auth/sessionStore';
import { withApiRequestHistory } from '@/features/apiRequests/apiRequestHistory';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/**
 * Returns account details for a valid session.
 * 1. Resolve matching device and session cookies and reject missing or expired sessions.
 * 2. Load the account and reject sessions whose user no longer exists.
 * 3. Return the public details without allowing the response to be cached.
 */
async function handleCurrentUser(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };

  try {
    // STEP 1: Both cookies must resolve to the same active database session.
    const userId = await getSessionUserId(request);
    if (!userId) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } },
        { status: 401, headers },
      );
    }

    // STEP 2: A session is invalid if its account has been removed.
    const user = await findCurrentUser(userId);
    if (!user) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } },
        { status: 401, headers },
      );
    }

    // STEP 3: Return only the details required by the dashboard and profile.
    return Response.json({ data: user }, { status: 200, headers });
  } catch (error) {
    console.error('Failed to load the current user.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not load your account right now.' } },
      { status: 500, headers },
    );
  }
}

/** Records the outcome of one current-user request. */
export function GET(request: Request): Promise<Response> {
  return withApiRequestHistory(request, () => handleCurrentUser(request));
}
