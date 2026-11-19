import { useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '../api/client';
import { saveRecoveredPassword } from '../api/passwordRecovery';
import AuthInput from '../components/AuthInput';
import { useRecoveryFlow } from '../features/passwordRecovery/RecoveryFlowContext';
import { authColors } from '../theme/authColors';
import { authStyles } from '../theme/authStyles';

type PasswordValues = { password: string; confirmPassword: string };
type PasswordField = keyof PasswordValues;
type PasswordErrors = Partial<Record<PasswordField, string>>;

const initialValues: PasswordValues = { password: '', confirmPassword: '' };

/**
 * Checks new password fields against the existing account rules.
 * 1. Require a password between 8 and 128 characters.
 * 2. Require confirmation to match that password.
 */
function validatePasswords(values: PasswordValues): PasswordErrors {
  const errors: PasswordErrors = {};

  // STEP 1: Match the server's current password length requirement.
  if (values.password.length < 8 || values.password.length > 128) {
    errors.password = 'Use a password between 8 and 128 characters.';
  }

  // STEP 2: Keep a mismatch beside the confirmation field.
  if (!values.confirmPassword || values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords must match.';
  }
  return errors;
}

/**
 * Saves a new password after the email code has been verified.
 * 1. Track password fields and request progress.
 * 2. Validate and submit the password with the in-memory grant.
 * 3. Return to login only after the server confirms the change.
 */
export default function ResetPasswordPage() {
  // STEP 1: Keep password drafts only in this screen's state.
  const [values, setValues] = useState<PasswordValues>(initialValues);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const router = useRouter();
  const recovery = useRecoveryFlow();

  /** Saves a field edit and clears feedback that described its old value. */
  function updateField(field: PasswordField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFeedback('');
  }

  // STEP 2: Submit only after local validation and server-side code verification.
  /**
   * Submits the new password using a verified grant.
   * 1. Reject duplicate or invalid submissions.
   * 2. Save the password and navigate to login after success.
   * 3. Keep the form available when the request fails.
   */
  async function handleSavePassword() {
    // STEP 1: Require a grant and valid passwords before submitting.
    if (submissionInFlight.current || !recovery.token) return;
    const nextErrors = validatePasswords(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback('Please correct the highlighted fields.');
      return;
    }

    // STEP 2: Do not navigate until the server changes the password.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setFeedback('');
    try {
      await saveRecoveredPassword(recovery.token, values.password, values.confirmPassword);
      recovery.clear();
      router.replace({ pathname: '/login', params: { recovered: '1' } });
    } catch (requestError) {
      // STEP 3: Preserve user input and show server field errors for correction.
      if (requestError instanceof ApiRequestError) {
        setErrors({
          password: requestError.fieldErrors.password,
          confirmPassword: requestError.fieldErrors.confirmPassword,
        });
        setFeedback(requestError.message);
      } else {
        setFeedback('Could not save your new password. Please try again.');
      }
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Keep the form responsive on web, Android, and iOS.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <Text style={authStyles.title}>Set a new password</Text>
        <Text style={authStyles.subtitle}>
          {recovery.token ? 'Choose a new password and confirm it below.' : 'Verify a recovery code before setting a new password.'}
        </Text>

        {recovery.token ? <View style={authStyles.form}>
          <AuthInput
            label="New password"
            value={values.password}
            onChangeText={(text) => updateField('password', text)}
            error={errors.password}
            autoComplete="new-password"
            secureTextEntry
            editable={!isSubmitting}
          />
          <AuthInput
            label="Confirm new password"
            value={values.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            error={errors.confirmPassword}
            autoComplete="new-password"
            secureTextEntry
            editable={!isSubmitting}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleSavePassword}
            style={({ pressed }) => [authStyles.button, isSubmitting && authStyles.buttonDisabled, pressed && authStyles.buttonPressed]}
          >
            <Text style={authStyles.buttonText}>{isSubmitting ? 'Saving...' : 'Save new password'}</Text>
          </Pressable>
          {feedback ? (
            <Text accessibilityRole="alert" style={[authStyles.result, authStyles.resultError]}>{feedback}</Text>
          ) : null}
        </View> : null}
        <Link href="/forgot-password" style={styles.backLink}>Request another code</Link>
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
