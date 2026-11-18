import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { requestPasswordReset } from '../api/auth';
import { ApiRequestError } from '../api/client';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import { authStyles } from '../theme/authStyles';

type Feedback = { message: string; kind: 'success' | 'error' } | null;

/**
 * Requests a password reset link on web, Android, and iOS.
 * 1. Track the email, feedback, and request progress.
 * 2. Validate and submit the email through the shared API module.
 * 3. Show generic success or actionable errors without exposing account existence.
 */
export default function ForgotPasswordPage() {
  // STEP 1: Keep the entered email and request feedback local to this screen.
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);

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
   * Submits one valid email and reports the server's result.
   * 1. Reject overlapping requests and invalid addresses.
   * 2. Request a reset link through the shared API module.
   * 3. Show success or field and connection errors, then restore the form.
   */
  async function handleSendResetLink() {
    // STEP 1: Stop duplicate taps and keep invalid addresses on the form.
    if (submissionInFlight.current) return;
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      setError('Enter a valid email address.');
      setFeedback(null);
      return;
    }

    // STEP 2: Show progress until the server accepts or rejects the request.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setError('');
    setFeedback(null);
    try {
      await requestPasswordReset(normalizedEmail);
      // NOTE: The server returns the same success response for unknown addresses.
      setFeedback({ kind: 'success', message: 'If this email is registered, a password reset link has been sent to your inbox.' });
    } catch (requestError) {
      // STEP 3: Show server field errors and connection failures without claiming delivery.
      if (requestError instanceof ApiRequestError) {
        setError(requestError.fieldErrors.email ?? '');
        setFeedback({ kind: 'error', message: requestError.message });
      } else {
        setFeedback({ kind: 'error', message: 'Could not request a reset link. Please try again.' });
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Render the page with the shared authentication design.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={authStyles.title}>Forgot your password?</Text>
        <Text style={authStyles.subtitle}>Enter your email address and we will send you a password reset link.</Text>

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

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }} disabled={isSubmitting} onPress={handleSendResetLink} style={({ pressed }) => [authStyles.button, isSubmitting && authStyles.buttonDisabled, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>{isSubmitting ? 'Sending...' : 'Send Reset Link'}</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={[authStyles.result, feedback.kind === 'error' && authStyles.resultError]}>{feedback.message}</Text> : null}
        </View>
        <AuthNavigation current="forgot-password" />
      </View>
    </ScrollView>
  );
}
