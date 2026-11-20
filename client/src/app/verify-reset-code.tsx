import { useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { ApiRequestError } from '../api/client';
import { verifyPasswordRecoveryCode } from '../api/passwordRecovery';
import VerificationCodeForm, { type VerificationCodeFeedback } from '../components/VerificationCodeForm';
import AuthScreen from '../components/AuthScreen';
import { useRecoveryFlow } from '../features/passwordRecovery/RecoveryFlowContext';
import { authColors } from '../theme/authColors';
import { authStyles } from '../theme/authStyles';

const codeLength = 8;

/**
 * Verifies the emailed code using the reusable code-entry component.
 * 1. Keep the code and request feedback in screen state.
 * 2. Exchange a valid code for a one-time grant through the shared API.
 * 3. Open password entry only after the server confirms the code.
 */
export default function VerifyResetCodePage() {
  // STEP 1: Track the code and request feedback for this screen.
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<VerificationCodeFeedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const router = useRouter();
  const recovery = useRecoveryFlow();

  /** Clears feedback that no longer describes the edited code. */
  function updateCode(value: string) {
    setCode(value);
    setError('');
    setFeedback(null);
  }

  // STEP 2: Verify the code before granting access to password entry.
  /**
   * Submits one code verification without limiting failed attempts.
   * 1. Validate eight digits and prevent overlapping requests.
   * 2. Keep the returned grant in memory and open password entry.
   * 3. Show code or request feedback while allowing another attempt.
   */
  async function handleVerify() {
    // STEP 1: Invalid drafts remain editable without an API request.
    if (submissionInFlight.current || !recovery.email) return;
    if (!/^[0-9]{8}$/.test(code)) {
      setError('Enter the 8-digit code.');
      setFeedback(null);
      return;
    }

    // STEP 2: A successful response contains the grant, which never enters a URL.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setError('');
    setFeedback(null);
    try {
      const { token } = await verifyPasswordRecoveryCode(recovery.email, code);
      recovery.authorize(token);
      router.replace('/reset-password');
    } catch (requestError) {
      // STEP 3: Wrong codes can be edited and retried without a client-side limit.
      if (requestError instanceof ApiRequestError) {
        setError(requestError.fieldErrors.code ?? '');
        setFeedback({ kind: 'error', message: requestError.message });
      } else {
        setFeedback({ kind: 'error', message: 'Could not verify the code. Please try again.' });
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Keep code entry shared across delivery channels.
  return (
    <AuthScreen title="Enter verification code">
        {recovery.email ? (
          <>
            <Text style={authStyles.subtitle}>If an account uses {recovery.email}, an 8-digit code was sent to it.</Text>
            <VerificationCodeForm
              code={code}
              codeLength={codeLength}
              error={error}
              feedback={feedback}
              isSubmitting={isSubmitting}
              onCodeChange={updateCode}
              onVerify={handleVerify}
            />
          </>
        ) : (
          <Text style={authStyles.subtitle}>Enter your email address first to request a recovery code.</Text>
        )}
        <Link href="/forgot-password" style={styles.backLink}>Back to email address</Link>
    </AuthScreen>
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
