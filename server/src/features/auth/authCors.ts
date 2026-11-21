/** Matches one of the explicitly configured web origins. */
export function isAllowedClientOrigin(origin: string | null): boolean {
  return Boolean(origin && process.env.CLIENT_ORIGIN?.split(',').some((allowed) => allowed.trim() === origin));
}

/** Allows credentialed browser requests from the configured client origins. */
export function authCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  const localOrigin = process.env.NODE_ENV !== 'production' &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!isAllowedClientOrigin(origin) && !localOrigin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Platform, X-Client-Os-Version, X-Client-Model',
    'Access-Control-Expose-Headers': 'Retry-After',
    Vary: 'Origin',
  };
}
