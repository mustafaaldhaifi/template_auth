import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, Text, View } from 'react-native';
import { ApiRequestError } from '../api/client';
import { requestPasswordRecoveryCode } from '../api/passwordRecovery';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import AuthSubmitButton from '../components/AuthSubmitButton';
import TurnstileVerification from '../components/TurnstileVerification';
import type { TurnstileVerificationHandle } from '../components/TurnstileVerification.types';
import { useRecoveryFlow } from '../features/passwordRecovery/RecoveryFlowContext';
import { authStyles } from '../theme/authStyles';

/**
 * Requests an emailed recovery code on web, Android, and iOS.
 * 1. Validate the address and require a web verification proof.
 * 2. Send one request through the shared API client.
 * 3. Continue to code entry or show field and request errors.
 */
export default function ForgotPasswordPage() {
  // STEP 1: Track the current address and request status.
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const verificationRef = useRef<TurnstileVerificationHandle>(null);
  const submissionInFlight = useRef(false);
  const router = useRouter();
  const recovery = useRecoveryFlow();

  /** Clears feedback that no longer describes the edited address. */
  function updateEmail(value: string) {
    setEmail(value);
    setError('');
    setResult('');
  }

  // STEP 2: Submit only validated addresses through the recovery API.
  /**
   * Sends one code request and advances only after the server responds.
   * 1. Reject duplicate, invalid, or unverified web requests.
   * 2. Remember the normalized address and open code entry on success.
   * 3. Keep the form available with feedback and refresh the consumed proof.
   */
  async function handleSendRecoveryCode() {
    // STEP 1: Check the draft before contacting the server.
    if (submissionInFlight.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      setError('Enter a valid email address.');
      setResult('Please correct the highlighted field.');
      return;
    }
    if (Platform.OS === 'web' && !verificationToken) {
      setResult('Complete the security check before requesting a recovery code.');
      return;
    }

    // STEP 2: The response is intentionally the same for registered and unknown addresses.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setError('');
    setResult('');
    try {
      await requestPasswordRecoveryCode(normalizedEmail, Platform.OS === 'web'
        ? { verificationToken, verificationMethod: 'turnstile' }
        : undefined);
      recovery.begin(normalizedEmail);
      router.replace('/verify-reset-code');
    } catch (requestError) {
      // STEP 3: Associate field errors with the email input.
      if (requestError instanceof ApiRequestError) {
        setError(requestError.fieldErrors.email ?? '');
        setResult(requestError.message);
      } else {
        setResult('Could not request a recovery code. Please try again.');
      }
    } finally {
      verificationRef.current?.reset();
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Keep request and field feedback on the same form.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
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
            editable={!isSubmitting}
          />

          <TurnstileVerification action="forgot_password" ref={verificationRef} onTokenChange={setVerificationToken} />

          <AuthSubmitButton label="Send recovery code" pendingLabel="Sending..." isSubmitting={isSubmitting} disabled={Platform.OS === 'web' && !verificationToken} onPress={handleSendRecoveryCode} />
          {result ? <Text accessibilityRole="alert" style={[authStyles.result, authStyles.resultError]}>{result}</Text> : null}
        </View>
        <AuthNavigation current="forgot-password" />
      </View>
    </ScrollView>
  );
}
