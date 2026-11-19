export type TurnstileCheck = 'valid' | 'invalid' | 'unavailable';

const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const serviceErrors = new Set(['internal-error', 'missing-input-secret', 'invalid-input-secret', 'bad-request']);

/**
 * Checks one web proof with Cloudflare before any account or device access.
 * 1. Require the server secret and an explicit hostname allowlist.
 * 2. Redeem the token through Siteverify with a bounded network wait.
 * 3. Accept only a successful response for the expected action and hostname.
 */
export async function verifyTurnstileToken(token: string, expectedAction: string): Promise<TurnstileCheck> {
  // STEP 1: Fail closed when the deployment has incomplete verification settings.
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const allowedHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES
    ?.split(',').map((hostname) => hostname.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!secret || allowedHostnames.length === 0) return 'unavailable';

  // STEP 2: Cloudflare redeems each short-lived token; do not send the secret to the client.
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(siteverifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!response.ok) return 'unavailable';
    payload = await response.json();
  } catch {
    return 'unavailable';
  }

  // STEP 3: Reject a provider failure or a proof issued for another form or site.
  if (!payload || typeof payload !== 'object') return 'unavailable';
  const result = payload as Record<string, unknown>;
  if (result.success === false) {
    const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    return codes.some((code) => typeof code === 'string' && serviceErrors.has(code))
      ? 'unavailable' : 'invalid';
  }
  if (result.success !== true) return 'unavailable';
  if (result.action !== expectedAction || typeof result.hostname !== 'string' ||
      !allowedHostnames.includes(result.hostname.toLowerCase())) return 'invalid';
  return 'valid';
}
