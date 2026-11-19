import { isAllowedClientOrigin } from './authCors';

/** Reads one named cookie without trusting other values in the header. */
export function readAuthCookie(request: Request, name: string): string | null {
  const entry = request.headers.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

/** Produces a host-scoped HttpOnly cookie for a server-issued opaque token. */
export function authCookie(name: string, token: string, lifetimeSeconds: number, request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  const secure = process.env.NODE_ENV === 'production' || requestOrigin.startsWith('https://');
  const clientOrigin = request.headers.get('origin');
  // NOTE: A separately hosted, allowlisted web client needs a Secure cross-site cookie.
  const crossSite = secure && isAllowedClientOrigin(clientOrigin) && clientOrigin !== requestOrigin;
  return `${name}=${token}; Path=/; HttpOnly; SameSite=${crossSite ? 'None' : 'Lax'}; Max-Age=${lifetimeSeconds}${secure ? '; Secure' : ''}`;
}

/** Removes one cookie without affecting other authentication cookies. */
export function expiredAuthCookie(name: string, request: Request): string {
  return authCookie(name, '', 0, request);
}

/** Appends a cookie so a response can issue both device and session tokens. */
export function appendAuthCookie(response: Response, cookie: string | null): Response {
  if (cookie) response.headers.append('Set-Cookie', cookie);
  return response;
}
