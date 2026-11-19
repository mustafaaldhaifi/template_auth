import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import TurnstileVerification from '../components/TurnstileVerification';
import type { TurnstileVerificationHandle } from '../components/TurnstileVerification.types';
import { ApiRequestError } from '../api/client';
import { login, type LoginValues } from '../api/auth';
import { authStyles } from '../theme/authStyles';

type LoginField = 'email' | 'password';
type LoginErrors = Partial<Record<LoginField, string>>;

const initialValues: LoginValues = { email: '', password: '' };

/**
 * Checks the two login fields before authentication.
 * 1. Require a valid email address.
 * 2. Require a non-empty password.
 * 3. Return messages associated with the invalid fields.
 */
function validateLogin(values: LoginValues): LoginErrors {
  const errors: LoginErrors = {};

  // STEP 1: Check the email format.
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim()) || values.email.trim().length > 254) {
    errors.email = 'Enter a valid email address.';
  }

  // STEP 2: Require a password without imposing sign-up password rules.
  if (!values.password || values.password.length > 128) {
    errors.password = 'Enter a password of up to 128 characters.';
  }

  // STEP 3: Keep feedback next to the affected fields.
  return errors;
}

/**
 * Presents the login form on web, Android, and iOS.
 * 1. Track credentials, field errors, and request progress.
 * 2. Validate credentials and submit a web verification proof through the shared API module.
 * 3. Navigate to the dashboard on success or display the server error.
 */
export default function LoginPage() {
  // STEP 1: Hold only the current form values and feedback.
  const [values, setValues] = useState<LoginValues>(initialValues);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [result, setResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const verificationRef = useRef<TurnstileVerificationHandle>(null);
  const submissionInFlight = useRef(false);
  const router = useRouter();
  const { recovered } = useLocalSearchParams<{ recovered?: string }>();

  /**
   * Updates a field and clears feedback that may no longer apply.
   * 1. Save the new field value.
   * 2. Remove that field's error and the previous result.
   */
  function updateField(field: LoginField, value: string) {
    // STEP 1: Preserve the other field while saving the edit.
    setValues((current) => ({ ...current, [field]: value }));

    // STEP 2: Clear stale feedback after the edit.
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setResult('');
  }

  /**
   * Submits one login request after local validation.
   * 1. Reject duplicate, invalid, or unverified web submissions.
   * 2. Send credentials and navigate after the session is created.
   * 3. Show errors and refresh the consumed web proof when the request ends.
   */
  async function handleSubmit() {
    // STEP 1: Keep an overlapping request from creating multiple sessions.
    if (submissionInFlight.current) return;
    const nextErrors = validateLogin(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult('Please correct the highlighted fields.');
      return;
    }
    if (Platform.OS === 'web' && !verificationToken) {
      setResult('Complete the security check before logging in.');
      return;
    }
    // STEP 2: Move to the dashboard only after the server accepts credentials.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setResult('');
    try {
      await login(values, Platform.OS === 'web'
        ? { verificationToken, verificationMethod: 'turnstile' }
        : undefined);
      router.replace('/dashboard');
    } catch (error) {
      // STEP 3: Keep the form available with the server's specific feedback.
      if (error instanceof ApiRequestError) {
        setErrors({ email: error.fieldErrors.email, password: error.fieldErrors.password });
        setResult(error.message);
      } else {
        setResult('Could not log in. Please try again.');
      }
    } finally {
      verificationRef.current?.reset();
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Render the login page with the shared authentication design.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>WELCOME BACK</Text>
        <Text style={authStyles.title}>Log in to your account</Text>
        <Text style={authStyles.subtitle}>Enter your email and password to continue.</Text>
        {recovered === '1' && !result ? (
          <Text accessibilityRole="alert" style={authStyles.result}>
            Password updated. Sign in with your new password.
          </Text>
        ) : null}

        <View style={authStyles.form}>
          <AuthInput
            label="Email address"
            value={values.email}
            onChangeText={(text) => updateField('email', text)}
            error={errors.email}
            autoComplete="email"
            keyboardType="email-address"
            editable={!isSubmitting}
          />
          <AuthInput
            label="Password"
            value={values.password}
            onChangeText={(text) => updateField('password', text)}
            error={errors.password}
            autoComplete="current-password"
            secureTextEntry
            editable={!isSubmitting}
          />

          <TurnstileVerification action="login" ref={verificationRef} onTokenChange={setVerificationToken} />

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting || (Platform.OS === 'web' && !verificationToken), busy: isSubmitting }} disabled={isSubmitting || (Platform.OS === 'web' && !verificationToken)} onPress={handleSubmit} style={({ pressed }) => [authStyles.button, (isSubmitting || (Platform.OS === 'web' && !verificationToken)) && authStyles.buttonDisabled, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>{isSubmitting ? 'Logging in...' : 'Log in'}</Text>
          </Pressable>
          {result ? <Text accessibilityRole="alert" style={[authStyles.result, authStyles.resultError]}>{result}</Text> : null}
        </View>
        <AuthNavigation current="login" />
      </View>
    </ScrollView>
  );
}
