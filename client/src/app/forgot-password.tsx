import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ApiRequestError } from '../api/client';
import { requestPasswordRecoveryCode } from '../api/passwordRecovery';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import { useRecoveryFlow } from '../features/passwordRecovery/RecoveryFlowContext';
import { authStyles } from '../theme/authStyles';

/**
 * Requests an emailed recovery code on web, Android, and iOS.
 * 1. Validate the address and prevent overlapping submissions.
 * 2. Send the request through the shared API client.
 * 3. Continue to code entry or show field and request errors.
 */
export default function ForgotPasswordPage() {
  // STEP 1: Track the current address and request status.
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
   * 1. Reject duplicate requests and invalid addresses.
   * 2. Remember the normalized address and open code entry on success.
   * 3. Keep the form available with server feedback on failure.
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

    // STEP 2: The response is intentionally the same for registered and unknown addresses.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setError('');
    setResult('');
    try {
      await requestPasswordRecoveryCode(normalizedEmail);
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
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Keep request and field feedback on the same form.
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
            editable={!isSubmitting}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleSendRecoveryCode}
            style={({ pressed }) => [authStyles.button, isSubmitting && authStyles.buttonDisabled, pressed && authStyles.buttonPressed]}
          >
            <Text style={authStyles.buttonText}>{isSubmitting ? 'Sending...' : 'Send recovery code'}</Text>
          </Pressable>
          {result ? <Text accessibilityRole="alert" style={[authStyles.result, authStyles.resultError]}>{result}</Text> : null}
        </View>
        <AuthNavigation current="forgot-password" />
      </View>
    </ScrollView>
  );
}
