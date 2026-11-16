import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppNavigation from '../components/AppNavigation';
import { authColors } from '../theme/authColors';

const sampleProfile = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
};

const profileFields = [
  { label: 'First name', value: sampleProfile.firstName },
  { label: 'Last name', value: sampleProfile.lastName },
  { label: 'Email address', value: sampleProfile.email },
];

/**
 * Shows a sample profile and shared home/profile navigation.
 * 1. Render the shared navigation with Profile selected.
 * 2. Identify the displayed person as sample data.
 * 3. List the sample first name, last name, and email address.
 */
export default function ProfilePage() {
  // STEP 1: Make both home and profile available from this screen.
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <AppNavigation current="profile" />

        {/* STEP 2: State clearly that this is example profile information. */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>A preview of the personal details shown in your space.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}><Text style={styles.avatarText}>JD</Text></View>
            <View style={styles.identity}>
              <Text style={styles.name}>Jane Doe</Text>
              <Text style={styles.sampleLabel}>SAMPLE PROFILE</Text>
            </View>
          </View>

          {/* STEP 3: Present the approved sample fields in a readable list. */}
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
  sampleLabel: { color: authColors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 7 },
  details: { borderTopColor: authColors.border, borderTopWidth: 1 },
  detailRow: { paddingVertical: 17, borderBottomColor: authColors.border, borderBottomWidth: 1 },
  detailLabel: { color: authColors.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  detailValue: { color: authColors.ink, fontSize: 16, lineHeight: 23 },
});
