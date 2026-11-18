import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { getCurrentUser, type CurrentUser } from '../api/auth';
import { ApiRequestError } from '../api/client';

type AuthenticatedUserState =
  | { status: 'loading' }
  | { status: 'ready'; user: CurrentUser }
  | { status: 'error'; message: string };

/**
 * Resolves the account required by protected screens.
 * 1. Request the current user when the screen loads or the user retries.
 * 2. Redirect invalid sessions to login without showing protected content.
 * 3. Expose temporary failures for a retry on the current screen.
 */
export function useAuthenticatedUser() {
  const router = useRouter();
  const [state, setState] = useState<AuthenticatedUserState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // STEP 1: Ignore a response if navigation has unmounted this screen.
  useEffect(() => {
    let active = true;

    /**
     * Resolves this screen's session request.
     * 1. Load the account while this screen is active.
     * 2. Redirect when the session is invalid.
     * 3. Show a retryable error for other failures.
     */
    async function loadUser() {
      try {
        const user = await getCurrentUser();
        if (active) setState({ status: 'ready', user });
      } catch (error) {
        if (!active) return;

        // STEP 2: A missing or expired session requires a new login.
        if (error instanceof ApiRequestError && error.code === 'UNAUTHORIZED') {
          router.replace('/login');
          return;
        }

        // STEP 3: Network and server failures leave the screen available for retry.
        setState({
          status: 'error',
          message: error instanceof ApiRequestError
            ? error.message
            : 'Could not load your account. Please try again.',
        });
      }
    }

    void loadUser();
    return () => { active = false; };
  }, [attempt, router]);

  /** Starts a new request only after the previous one has finished. */
  function retry() {
    if (state.status !== 'error') return;
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }

  return { state, retry };
}
