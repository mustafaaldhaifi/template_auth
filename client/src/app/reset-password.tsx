import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AuthInput from '../components/AuthInput';
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
 * Presents a password reset form before backend submission is connected.
 * 1. Track both password fields and local feedback.
 * 2. Validate the draft without changing the account password.
 * 3. Render the shared authentication layout and a way back to code entry.
 */
export default function ResetPasswordPage() {
  // STEP 1: Keep password drafts only in this screen's state.
  const [values, setValues] = useState<PasswordValues>(initialValues);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [feedback, setFeedback] = useState('');

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

  /**
   * Validates the draft without claiming the password was saved.
   * 1. Show field errors for invalid values.
   * 2. Explain that saving awaits the recovery API integration.
   */
  function handleSavePassword() {
    // STEP 1: Keep invalid values on the form for correction.
    const nextErrors = validatePasswords(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback('Please correct the highlighted fields.');
      return;
    }

    // STEP 2: Do not navigate to login until the server changes the password.
    setFeedback('Password saving is not available yet.');
  }

  // STEP 3: Keep the form responsive on web, Android, and iOS.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={authStyles.title}>Set a new password</Text>
        <Text style={authStyles.subtitle}>Choose a new password and confirm it below.</Text>

        <View style={authStyles.form}>
          <AuthInput
            label="New password"
            value={values.password}
            onChangeText={(text) => updateField('password', text)}
            error={errors.password}
            autoComplete="new-password"
            secureTextEntry
          />
          <AuthInput
            label="Confirm new password"
            value={values.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            error={errors.confirmPassword}
            autoComplete="new-password"
            secureTextEntry
          />

          <Pressable
            accessibilityRole="button"
            onPress={handleSavePassword}
            style={({ pressed }) => [authStyles.button, pressed && authStyles.buttonPressed]}
          >
            <Text style={authStyles.buttonText}>Save new password</Text>
          </Pressable>
          {feedback ? (
            <Text accessibilityRole="alert" style={[authStyles.result, authStyles.resultError]}>{feedback}</Text>
          ) : null}
        </View>
        <Link href="/verify-reset-code" style={styles.backLink}>Back to verification code</Link>
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
