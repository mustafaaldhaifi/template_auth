import { useState } from 'react';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import VerificationCodeForm, { type VerificationCodeFeedback } from '../components/VerificationCodeForm';
import { authColors } from '../theme/authColors';
import { authStyles } from '../theme/authStyles';

const codeLength = 8;

/**
 * Presents the email recovery code screen before API verification is connected.
 * 1. Keep the code and local feedback in screen state.
 * 2. Validate eight digits without accepting a code or changing a password.
 * 3. Render the shared code form and a way back to the email step.
 */
export default function VerifyResetCodePage() {
  // STEP 1: Keep this draft independent of future email or phone delivery logic.
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<VerificationCodeFeedback>(null);

  /** Clears feedback that no longer describes the edited code. */
  function updateCode(value: string) {
    setCode(value);
    setError('');
    setFeedback(null);
  }

  /**
   * Validates the code locally while backend verification is pending.
   * 1. Require exactly eight decimal digits.
   * 2. Report that verification is unavailable without implying success.
   */
  function handleVerify() {
    // STEP 1: Reject incomplete or malformed codes next to the input.
    if (!/^\d{8}$/.test(code)) {
      setError('Enter the 8-digit code.');
      setFeedback(null);
      return;
    }

    // STEP 2: A formatted code is not proof of ownership until the API checks it.
    setError('');
    setFeedback({ kind: 'error', message: 'Code verification is not available yet.' });
  }

  // STEP 3: Reuse the authentication layout and shared code form on every platform.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={authStyles.title}>Enter verification code</Text>
        <Text style={authStyles.subtitle}>Enter the 8-digit code from your email.</Text>

        <VerificationCodeForm
          code={code}
          codeLength={codeLength}
          error={error}
          feedback={feedback}
          onCodeChange={updateCode}
          onVerify={handleVerify}
        />
        <Link href="/forgot-password" style={styles.backLink}>Back to email address</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backLink: {
    color: authColors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
