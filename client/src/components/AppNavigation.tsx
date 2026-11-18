import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../theme/authColors';

type AppNavigationProps = {
  current: 'dashboard' | 'profile';
  onLogout?: () => void;
  logoutPending?: boolean;
};

export default function AppNavigation({ current, onLogout, logoutPending = false }: AppNavigationProps) {
  // NOTE: Expo Router's asChild Slot rejects style arrays on its direct child.
  const homeLinkStyle = current === 'dashboard'
    ? StyleSheet.flatten([styles.link, styles.linkActive])
    : styles.link;
  const profileLinkStyle = current === 'profile'
    ? StyleSheet.flatten([styles.link, styles.linkActive])
    : styles.link;

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.mark}><Text style={styles.markText}>A</Text></View>
        <Text style={styles.brandName}>Your space</Text>
      </View>
      <View style={styles.links}>
        <Link href="/dashboard" asChild>
          <Pressable accessibilityLabel="Home" style={homeLinkStyle}>
            <Text style={[styles.linkText, current === 'dashboard' && styles.linkTextActive]}>Home</Text>
          </Pressable>
        </Link>
        <Link href="/profile" asChild>
          <Pressable accessibilityLabel="Profile" style={profileLinkStyle}>
            <Text style={[styles.linkText, current === 'profile' && styles.linkTextActive]}>Profile</Text>
          </Pressable>
        </Link>
        {onLogout ? (
          <Pressable accessibilityLabel="Log out" accessibilityRole="button" accessibilityState={{ disabled: logoutPending, busy: logoutPending }} disabled={logoutPending} onPress={onLogout} style={styles.link}>
            <Text style={styles.linkText}>{logoutPending ? 'Logging out...' : 'Log out'}</Text>
          </Pressable>
        ) : (
          <Link href="/login" asChild>
            <Pressable accessibilityLabel="Log in" style={styles.link}>
              <Text style={styles.linkText}>Log in</Text>
            </Pressable>
          </Link>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 42 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  mark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: authColors.accent, marginRight: 11 },
  markText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  brandName: { color: authColors.ink, fontSize: 17, fontWeight: '700' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { minHeight: 40, minWidth: 70, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  linkActive: { backgroundColor: authColors.accent },
  linkText: { color: authColors.muted, fontSize: 14, fontWeight: '600' },
  linkTextActive: { color: '#FFFFFF' },
});
