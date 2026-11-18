import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import { authColors } from '../theme/authColors';
import { authStyles } from '../theme/authStyles';

type Feedback = { message: string; kind: 'success' | 'error' } | null;

/**
 * Prepares email recovery by code without invoking the legacy link endpoint.
 * 1. Keep the email and feedback in screen state.
 * 2. Validate the address locally and avoid claiming a code was sent.
 * 3. Link to the shared code-entry screen for interface review.
 */
export default function ForgotPasswordPage() {
  // STEP 1: Keep the entered email and local feedback on this screen.
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);

  /**
   * Saves the email draft and clears outdated feedback.
   * 1. Update the email value.
   * 2. Clear the previous validation error and result.
   */
  function updateEmail(value: string) {
    // STEP 1: Save the current draft.
    setEmail(value);

    // STEP 2: Clear feedback that described the previous draft.
    setError('');
    setFeedback(null);
  }

  /**
   * Checks the email without contacting the old link-sending endpoint.
   * 1. Show field feedback for an invalid address.
   * 2. Explain that code delivery will be connected in a later task.
   */
  function handleSendRecoveryCode() {
    // STEP 1: Keep invalid addresses on the form.
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      setError('Enter a valid email address.');
      setFeedback(null);
      return;
    }

    // STEP 2: Do not imply delivery before the code API is available.
    setError('');
    setFeedback({ kind: 'error', message: 'Recovery code delivery is not available yet.' });
  }

  // STEP 3: Keep the recovery pages reachable without sending a reset link.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={authStyles.title}>Forgot your password?</Text>
        <Text style={authStyles.subtitle}>Enter your email address to receive an 8-digit recovery code.</Text>

        <View style={authStyles.form}>
          <AuthInput
            label="Email address"
            value={email}
            onChangeText={updateEmail}
            error={error}
            autoComplete="email"
            keyboardType="email-address"
          />

          <Pressable accessibilityRole="button" onPress={handleSendRecoveryCode} style={({ pressed }) => [authStyles.button, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>Send recovery code</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={[authStyles.result, feedback.kind === 'error' && authStyles.resultError]}>{feedback.message}</Text> : null}
          <Link href="/verify-reset-code" style={styles.codeLink}>Enter a recovery code</Link>
        </View>
        <AuthNavigation current="forgot-password" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  codeLink: {
    color: authColors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
