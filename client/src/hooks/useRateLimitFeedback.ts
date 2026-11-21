import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ApiRequestError } from '../api/client';

/**
 * Shows the server's wait time and blocks repeated web submissions until it expires.
 * 1. Save the deadline from a 429 response on web.
 * 2. Refresh the displayed seconds while the form remains open.
 * 3. Allow another submission once the deadline has passed.
 */
export function useRateLimitFeedback() {
  const blockedUntilRef = useRef(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // STEP 2: The absolute deadline stays accurate if the browser pauses timers.
  useEffect(() => {
    if (!blockedUntil) return;
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) setBlockedUntil(0);
    };
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil]);

  /** Starts a cooldown only for a web response that supplies a valid wait time. */
  function handleRateLimit(error: ApiRequestError): boolean {
    if (Platform.OS !== 'web' || error.code !== 'TOO_MANY_REQUESTS') return false;
    // STEP 1: Keep the server's timing rather than guessing a local limit.
    if (error.retryAfterSeconds) {
      const deadline = Date.now() + error.retryAfterSeconds * 1000;
      blockedUntilRef.current = deadline;
      setBlockedUntil(deadline);
      setRemainingSeconds(error.retryAfterSeconds);
    }
    return true;
  }

  // STEP 3: A ref also guards the small interval before React renders the disabled button.
  function isBlocked(): boolean {
    return Platform.OS === 'web' && Date.now() < blockedUntilRef.current;
  }

  const waitMessage = remainingSeconds > 0
    ? `Too many requests. Try again in ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}.`
    : '';

  return { handleRateLimit, isBlocked, waitMessage, remainingSeconds };
}
