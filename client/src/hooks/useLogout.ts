import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { logout } from '../api/auth';
import { ApiRequestError } from '../api/client';

/**
 * Provides the existing logout flow to signed-in screens.
 * 1. Prevent overlapping logout requests and show progress.
 * 2. Clear the server session and return to login.
 * 3. Keep the current screen available with an error when logout fails.
 */
export function useLogout() {
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutInFlight = useRef(false);

  /**
   * Ends the current session after a logout tap.
   * 1. Block duplicate requests and show progress.
   * 2. Navigate to login after the server clears the session.
   * 3. Restore the action with feedback if the request fails.
   */
  async function handleLogout() {
    // STEP 1: Send only one request at a time.
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLogoutPending(true);
    setLogoutError('');
    try {
      // STEP 2: Leave the protected screen after the session ends.
      await logout();
      router.replace('/login');
    } catch (error) {
      // STEP 3: Keep logout available for another attempt.
      setLogoutError(error instanceof ApiRequestError ? error.message : 'Could not log out. Please try again.');
    } finally {
      logoutInFlight.current = false;
      setLogoutPending(false);
    }
  }

  return { handleLogout, logoutPending, logoutError };
}
