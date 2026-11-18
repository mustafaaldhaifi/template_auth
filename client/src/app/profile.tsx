import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AccountStatus from '../components/AccountStatus';
import AppNavigation from '../components/AppNavigation';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { useLogout } from '../hooks/useLogout';
import { authColors } from '../theme/authColors';

/**
 * Shows the signed-in user's profile and shared navigation.
 * 1. Check the session before showing personal details.
 * 2. Provide retry feedback for temporary request failures.
 * 3. Display the account's first name, last name, and email.
 */
export default function ProfilePage() {
  const { state, retry } = useAuthenticatedUser();
  const { handleLogout, logoutPending, logoutError } = useLogout();

  // STEP 1: Keep personal details hidden until the current session is verified.
  if (state.status !== 'ready') {
    // STEP 2: Offer a retry only when a temporary request failure occurs.
    return <AccountStatus error={state.status === 'error' ? state.message : undefined} onRetry={retry} />;
  }

  // STEP 3: Derive the visible identity from the server response.
  const { firstName, lastName, email } = state.user;
  const profileFields = [
    { label: 'First name', value: firstName },
    { label: 'Last name', value: lastName },
    { label: 'Email address', value: email },
  ];
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <AppNavigation current="profile" onLogout={handleLogout} logoutPending={logoutPending} />
        {logoutError ? <Text accessibilityRole="alert" style={styles.logoutError}>{logoutError}</Text> : null}

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>Your account details.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.identity}>
              <Text style={styles.name}>{firstName} {lastName}</Text>
            </View>
          </View>

          <View style={styles.details}>
            {profileFields.map((field) => (
              <View key={field.label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{field.label}</Text>
                <Text style={styles.detailValue}>{field.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: authColors.background, paddingHorizontal: 20, paddingVertical: 42 },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  logoutError: { color: authColors.error, fontSize: 14, marginBottom: 20 },
  hero: { marginBottom: 28 },
  eyebrow: { color: authColors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 11 },
  title: { color: authColors.ink, fontSize: 38, lineHeight: 46, fontWeight: '700' },
  subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 24, maxWidth: 590, marginTop: 12 },
  profileCard: { width: '100%', maxWidth: 720, backgroundColor: authColors.card, borderColor: authColors.border, borderWidth: 1, borderRadius: 18, padding: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 24 },
  avatar: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F1E9', marginRight: 16 },
  avatarText: { color: authColors.accent, fontSize: 20, fontWeight: '700' },
  identity: { flex: 1 },
  name: { color: authColors.ink, fontSize: 23, fontWeight: '700' },
  details: { borderTopColor: authColors.border, borderTopWidth: 1 },
  detailRow: { paddingVertical: 17, borderBottomColor: authColors.border, borderBottomWidth: 1 },
  detailLabel: { color: authColors.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  detailValue: { color: authColors.ink, fontSize: 16, lineHeight: 23 },
});
