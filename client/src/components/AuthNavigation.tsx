import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authColors } from '../theme/authColors';

type AuthRoute = 'signup' | 'login' | 'forgot-password';
type AuthNavigationProps = { current: AuthRoute };

const links = [
  { key: 'signup', label: 'Sign up', href: '/signup' },
  { key: 'login', label: 'Log in', href: '/login' },
  { key: 'forgot-password', label: 'Reset password', href: '/forgot-password' },
  { key: 'dashboard', label: 'Preview dashboard', href: '/dashboard' },
] as const;

export default function AuthNavigation({ current }: AuthNavigationProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.caption}>Explore other pages</Text>
      <View style={styles.links}>
        {links.filter((link) => link.key !== current).map((link) => (
          <Link key={link.key} href={link.href} style={styles.link}>
            {link.label}
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 28, paddingTop: 22, borderTopColor: authColors.border, borderTopWidth: 1, alignItems: 'center' },
  caption: { color: authColors.muted, fontSize: 12, marginBottom: 12 },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14 },
  link: { color: authColors.accent, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
