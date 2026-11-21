import { Redirect } from 'expo-router';
import AccountStatus from '../components/AccountStatus';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';

/** Opens the existing dashboard for an active session or login when it has expired. */
export default function IndexPage() {
  const { state, retry } = useAuthenticatedUser();
  if (state.status === 'ready') return <Redirect href="/dashboard" />;
  return <AccountStatus error={state.status === 'error' ? state.message : undefined} onRetry={retry} />;
}
