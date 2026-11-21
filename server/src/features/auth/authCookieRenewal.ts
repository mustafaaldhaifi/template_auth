import { appendAuthCookie } from './authCookies';
import { renewAuthActivity } from './authActivityRepository';
import { hashOpaqueToken, isOpaqueToken } from './authTokens';
import { refreshedDeviceCookie, requestDeviceTokenHash } from './deviceStore';
import { readSessionCookie, sessionCookie } from './sessionStore';

/**
 * Renews valid cookies only after an API operation succeeds.
 * 1. Leave failed responses and newly issued or cleared cookies untouched.
 * 2. Extend the device and, when applicable, its bound session in one transaction.
 * 3. Reissue only the tokens whose database records were extended.
 */
export async function withAuthCookieRenewal(
  request: Request,
  handler: () => Response | Promise<Response>,
): Promise<Response> {
  const response = await handler();
  // STEP 1: Preflight, failed, and token-issuing responses cannot renew old cookies.
  if (request.method === 'OPTIONS' || response.status < 200 || response.status >= 300) return response;
  const issuedCookies = response.headers.getSetCookie();
  const setsDevice = issuedCookies.some((cookie) => cookie.startsWith('auth_device='));
  const setsSession = issuedCookies.some((cookie) => cookie.startsWith('auth_session='));
  const deviceTokenHash = requestDeviceTokenHash(request);
  if (!deviceTokenHash) return response;
  const sessionToken = setsSession ? null : readSessionCookie(request);
  const sessionTokenHash = isOpaqueToken(sessionToken) ? hashOpaqueToken(sessionToken) : null;

  try {
    // STEP 2: Never issue a refreshed cookie before both database writes commit.
    const renewed = await renewAuthActivity(deviceTokenHash, sessionTokenHash);
    if (!renewed.device) return response;

    // STEP 3: Preserve a new login cookie or an explicit logout cookie already on the response.
    if (!setsDevice) appendAuthCookie(response, refreshedDeviceCookie(request));
    if (renewed.session && sessionToken) {
      appendAuthCookie(response, sessionCookie(sessionToken, request));
    }
  } catch (error) {
    // NOTE: A renewal failure must not turn a completed account operation into a retryable failure.
    console.error('Failed to renew authentication cookies.', error);
  }
  return response;
}
