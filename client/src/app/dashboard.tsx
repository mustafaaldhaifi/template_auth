import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { logout } from '../api/auth';
import { ApiRequestError } from '../api/client';
import AppNavigation from '../components/AppNavigation';
import { authColors } from '../theme/authColors';

const summaryCards = [
  { label: 'Projects', value: '03', detail: 'Example projects in your space' },
  { label: 'Updates', value: '02', detail: 'Recent sample updates' },
  { label: 'Next step', value: 'Profile', detail: 'Your account details at a glance' },
];

const sampleUpdates = [
  { title: 'Your workspace is ready', detail: 'A place for your important information.' },
  { title: 'Explore your overview', detail: 'See a simple snapshot of what is happening.' },
];

/**
 * Displays a sample home dashboard on web, Android, and iOS.
 * 1. Choose a card layout based on the available window width.
 * 2. Provide logout feedback and return to login after the session ends.
 * 3. Show navigation, sample summary cards, and recent activity.
 */
export default function DashboardPage() {
  // STEP 1: Reflow the summary cards as the window width changes.
  const { width } = useWindowDimensions();
  const showCardsInRow = width >= 760;
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutInFlight = useRef(false);

  /**
   * Ends the current session from the dashboard.
   * 1. Guard against repeated taps and show progress.
   * 2. Invalidate the session and return to login.
   * 3. Keep the screen visible with feedback if the request fails.
   */
  async function handleLogout() {
    // STEP 1: One request must finish before another starts.
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLogoutPending(true);
    setLogoutError('');
    try {
      // STEP 2: Navigate only after the server clears the session.
      await logout();
      router.replace('/login');
    } catch (error) {
      // STEP 3: Allow retry when the server cannot be reached.
      setLogoutError(error instanceof ApiRequestError ? error.message : 'Could not log out. Please try again.');
    } finally {
      logoutInFlight.current = false;
      setLogoutPending(false);
    }
  }

  // STEP 3: Present navigation, the welcome message, and sample overview.
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <AppNavigation current="dashboard" onLogout={handleLogout} logoutPending={logoutPending} />
        {logoutError ? <Text accessibilityRole="alert" style={styles.logoutError}>{logoutError}</Text> : null}

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>HOME</Text>
          <Text style={styles.title}>Welcome home</Text>
          <Text style={styles.subtitle}>Here is a simple look at your space. The information below is sample content.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.sampleLabel}>SAMPLE CONTENT</Text>
        </View>
        <View style={[styles.summaryGrid, showCardsInRow && styles.summaryGridWide]}>
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardDetail}>{card.detail}</Text>
            </View>
          ))}
        </View>

        {/* STEP 3: Keep the sample activity readable at every width. */}
        <View style={styles.activityCard}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.activityIntro}>A preview of updates in your space.</Text>
          {sampleUpdates.map((update, index) => (
            <View key={update.title} style={[styles.activityRow, index > 0 && styles.activityRowBorder]}>
              <View style={styles.activityDot} />
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>{update.title}</Text>
                <Text style={styles.activityDetail}>{update.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: authColors.background, paddingHorizontal: 20, paddingVertical: 42 },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  logoutError: { color: authColors.error, fontSize: 14, marginBottom: 20 },
  hero: { marginBottom: 38 },
  eyebrow: { color: authColors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 11 },
  title: { color: authColors.ink, fontSize: 38, lineHeight: 46, fontWeight: '700' },
  subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 24, maxWidth: 590, marginTop: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 16 },
  sectionTitle: { color: authColors.ink, fontSize: 21, fontWeight: '700' },
  sampleLabel: { color: authColors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  summaryGrid: { gap: 14, marginBottom: 24 },
  summaryGridWide: { flexDirection: 'row' },
  summaryCard: { flex: 1, minWidth: 0, padding: 22, backgroundColor: authColors.card, borderColor: authColors.border, borderWidth: 1, borderRadius: 18 },
  cardLabel: { color: authColors.muted, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  cardValue: { color: authColors.ink, fontSize: 32, fontWeight: '700', marginBottom: 7 },
  cardDetail: { color: authColors.muted, fontSize: 13, lineHeight: 19 },
  activityCard: { paddingHorizontal: 22, paddingVertical: 24, backgroundColor: authColors.card, borderColor: authColors.border, borderWidth: 1, borderRadius: 18 },
  activityIntro: { color: authColors.muted, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 15 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 16 },
  activityRowBorder: { borderTopColor: authColors.border, borderTopWidth: 1 },
  activityDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: authColors.accent, marginTop: 6, marginRight: 14 },
  activityText: { flex: 1 },
  activityTitle: { color: authColors.ink, fontSize: 15, fontWeight: '600' },
  activityDetail: { color: authColors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
