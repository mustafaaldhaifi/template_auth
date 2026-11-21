export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Sends a request to the configured backend and unwraps its standard response.
 * 1. Resolve the backend URL supplied for the current platform and environment.
 * 2. Send the request and parse the response, including network failures.
 * 3. Return response data or a user-facing error with field details and retry timing.
 */
export async function apiRequest<T>(path: string, options: RequestInit): Promise<T> {
  // STEP 1: Keep the backend address in one environment setting for every platform.
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!baseUrl) {
    throw new ApiRequestError('The server address is not configured.', 'API_NOT_CONFIGURED');
  }

  // STEP 2: Separate connection failures from responses returned by the server.
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, options);
  } catch {
    throw new ApiRequestError('Could not reach the server. Check your connection and try again.', 'NETWORK_ERROR');
  }
  const payload: unknown = await response.json().catch(() => null);

  // STEP 3: Unwrap successful data and preserve field errors from failed requests.
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data as T;
    }
    throw new ApiRequestError('The server sent an unexpected response.', 'INVALID_RESPONSE');
  }

  if (payload && typeof payload === 'object' && 'error' in payload &&
      payload.error && typeof payload.error === 'object') {
    const serverError = payload.error as Record<string, unknown>;
    const fieldErrors = serverError.fieldErrors && typeof serverError.fieldErrors === 'object'
      ? Object.fromEntries(
        Object.entries(serverError.fieldErrors).filter((entry): entry is [string, string] =>
          typeof entry[1] === 'string'),
      )
      : {};
    const retryAfterHeader = response.status === 429 ? Number(response.headers.get('Retry-After')) : 0;
    const retryAfterSeconds = Number.isSafeInteger(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader : null;
    throw new ApiRequestError(
      typeof serverError.message === 'string' ? serverError.message : 'The request failed.',
      typeof serverError.code === 'string' ? serverError.code : 'REQUEST_FAILED',
      fieldErrors,
      retryAfterSeconds,
    );
  }
  throw new ApiRequestError('The request failed. Please try again.', 'REQUEST_FAILED');
}
