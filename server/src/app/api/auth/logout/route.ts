import { authCorsHeaders } from '@/features/auth/authCors';
import { expiredSessionCookie, invalidateSession, readSessionCookie } from '@/features/auth/sessionStore';

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: authCorsHeaders(request) });
}

/** Invalidates the supplied local session and clears its browser cookie. */
export function POST(request: Request): Response {
  invalidateSession(readSessionCookie(request));
  return new Response(null, {
    status: 204,
    headers: { ...authCorsHeaders(request), 'Set-Cookie': expiredSessionCookie(request) },
  });
}
