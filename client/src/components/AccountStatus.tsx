import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../theme/authColors';

type AccountStatusProps = { error?: string; onRetry: () => void };

/** Shows account loading or a retryable error on protected screens. */
export default function AccountStatus({ error, onRetry }: AccountStatusProps) {
  return (
    <View style={styles.page}>
      {error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator accessibilityLabel="Loading your account" color={authColors.accent} size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: authColors.background },
  error: { color: authColors.error, fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryButton: { minHeight: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: authColors.accent },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
