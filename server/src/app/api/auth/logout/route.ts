import { authCorsHeaders } from '@/features/auth/authCors';
import { expiredSessionCookie, invalidateSession, readSessionCookie } from '@/features/auth/sessionStore';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/** Invalidates the supplied database session and clears only its session cookie. */
export async function POST(request: Request): Promise<Response> {
  const headers = { ...authCorsHeaders(request), 'Cache-Control': 'no-store' };
  try {
    await invalidateSession(readSessionCookie(request));
    return new Response(null, {
      status: 204,
      headers: { ...headers, 'Set-Cookie': expiredSessionCookie(request) },
    });
  } catch (error) {
    console.error('Failed to sign out.', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'We could not sign you out right now.' } },
      { status: 500, headers },
    );
  }
}
