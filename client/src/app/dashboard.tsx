import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AccountStatus from '../components/AccountStatus';
import AppNavigation from '../components/AppNavigation';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { useLogout } from '../hooks/useLogout';
import { authColors } from '../theme/authColors';

/**
 * Shows an otherwise empty home screen to signed-in users.
 * 1. Verify the current session before showing navigation.
 * 2. Let the user retry temporary account-loading failures.
 * 3. Keep navigation and logout available after verification.
 */
export default function DashboardPage() {
  const { state, retry } = useAuthenticatedUser();
  const { handleLogout, logoutPending, logoutError } = useLogout();

  // STEP 1: Do not show protected navigation before the session is checked.
  if (state.status !== 'ready') {
    // STEP 2: Offer a retry only when a temporary request failure occurs.
    return <AccountStatus error={state.status === 'error' ? state.message : undefined} onRetry={retry} />;
  }

  // STEP 3: Leave the page content empty while keeping navigation and logout.
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <AppNavigation current="dashboard" onLogout={handleLogout} logoutPending={logoutPending} />
        {logoutError ? <Text accessibilityRole="alert" style={styles.logoutError}>{logoutError}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: authColors.background, paddingHorizontal: 20, paddingVertical: 42 },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  logoutError: { color: authColors.error, fontSize: 14, marginBottom: 20 },
});
