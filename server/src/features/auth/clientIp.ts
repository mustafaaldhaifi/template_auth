import { isIP } from 'node:net';

/** Reads Next.js's forwarded IP locally and Vercel's trusted forwarded IP in production. */
export function trustedClientIp(request: Request): string | null {
  // NOTE: Local forwarding can be spoofed; only Vercel's overwritten header is trusted for production limits.
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') return null;
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return address && isIP(address) ? address : null;
}
