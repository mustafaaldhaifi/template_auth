import { useRef, useState } from 'react';
import {
  Pressable,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import TurnstileVerification from '../components/TurnstileVerification';
import type { TurnstileVerificationHandle } from '../components/TurnstileVerification.types';
import { ApiRequestError } from '../api/client';
import { signup, type SignupValues } from '../api/signup';
import { authStyles } from '../theme/authStyles';

type SignupField = keyof SignupValues;
type SignupErrors = Partial<Record<SignupField, string>>;
type SignupFeedback = { message: string; kind: 'success' | 'error' } | null;

const signupFields: SignupField[] = ['firstName', 'lastName', 'email', 'password', 'confirmPassword'];

const initialValues: SignupValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

/**
 * Checks the sign-up fields before sending them to the server.
 * 1. Require both names within the server's length limit and a valid email.
 * 2. Require a password of 8–128 characters and a matching confirmation.
 * 3. Return field-specific messages for the form to display.
 */
function validateSignup(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {};

  // STEP 1: Check the identity fields.
  if (!values.firstName.trim() || values.firstName.trim().length > 100) {
    errors.firstName = 'Enter a first name of up to 100 characters.';
  }
  if (!values.lastName.trim() || values.lastName.trim().length > 100) {
    errors.lastName = 'Enter a last name of up to 100 characters.';
  }
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim()) || values.email.trim().length > 254) {
    errors.email = 'Enter a valid email address.';
  }

  // STEP 2: Check the password and confirmation.
  if (values.password.length < 8 || values.password.length > 128) {
    errors.password = 'Use a password between 8 and 128 characters.';
  }
  if (!values.confirmPassword || values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords must match.';
  }

  // STEP 3: Let the screen show errors next to their fields.
  return errors;
}
/**
 * Presents the shared sign-up form on web, Android, and iOS.
 * 1. Keep entered values, errors, and request progress in local state.
 * 2. Validate and submit the form with web verification through the shared API module.
 * 3. Show the server result and links to the other pages.
 */
export default function SignupPage() {
  // STEP 1: Track the draft and feedback for the current form session.
  const [values, setValues] = useState<SignupValues>(initialValues);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [feedback, setFeedback] = useState<SignupFeedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const verificationRef = useRef<TurnstileVerificationHandle>(null);
  const submissionInFlight = useRef(false);

  /**
   * Updates one field while clearing feedback that is now stale.
   * 1. Save the new field value.
   * 2. Clear its error and the previous submit result.
   */
  function updateField(field: SignupField, value: string) {
    // STEP 1: Save the edit without changing the other fields.
    setValues((current) => ({ ...current, [field]: value }));

    // STEP 2: Remove feedback that no longer describes the draft.
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFeedback(null);
  }

  /**
   * Validates and submits the draft while preventing duplicate requests.
   * 1. Stop an overlapping, invalid, or unverified web submission.
   * 2. Send the separate name fields and credentials to the API.
   * 3. Display success, field errors, or a connection error.
   * 4. Clear progress and refresh the consumed web proof for another attempt.
   */
  async function handleSubmit() {
    // STEP 1: Guard against duplicate taps and invalid fields.
    if (submissionInFlight.current) return;
    const nextErrors = validateSignup(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: 'error', message: 'Please correct the highlighted fields.' });
      return;
    }
    if (Platform.OS === 'web' && !verificationToken) {
      setFeedback({ kind: 'error', message: 'Complete the security check before creating an account.' });
      return;
    }

    // STEP 2: Send one request and keep the form locked until it finishes.
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await signup(values, Platform.OS === 'web'
        ? { verificationToken, verificationMethod: 'turnstile' }
        : undefined);
      // STEP 3: Clear the submitted details only after the account exists.
      setValues(initialValues);
      setFeedback({ kind: 'success', message: 'Account created successfully.' });
    } catch (error) {
      // STEP 3: Map server field errors to the matching inputs on failure.
      if (error instanceof ApiRequestError) {
        const serverErrors: SignupErrors = {};
        for (const field of signupFields) {
          if (error.fieldErrors[field]) serverErrors[field] = error.fieldErrors[field];
        }
        setErrors(serverErrors);
        setFeedback({ kind: 'error', message: error.message });
      } else {
        setFeedback({ kind: 'error', message: 'Could not create your account. Please try again.' });
      }
    } finally {
      // STEP 4: Let the user submit again after the request finishes.
      verificationRef.current?.reset();
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Render the same responsive form on every supported platform.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>GET STARTED</Text>
        <Text style={authStyles.title}>Create your account</Text>
        <Text style={authStyles.subtitle}>Enter your details to create your new account.</Text>

        <View style={authStyles.form}>
          <AuthInput label="First name" value={values.firstName} onChangeText={(text) => updateField('firstName', text)} error={errors.firstName} autoComplete="given-name" autoCapitalize="words" editable={!isSubmitting} />
          <AuthInput label="Last name" value={values.lastName} onChangeText={(text) => updateField('lastName', text)} error={errors.lastName} autoComplete="family-name" autoCapitalize="words" editable={!isSubmitting} />
          <AuthInput label="Email address" value={values.email} onChangeText={(text) => updateField('email', text)} error={errors.email} autoComplete="email" keyboardType="email-address" editable={!isSubmitting} />
          <AuthInput label="Password" value={values.password} onChangeText={(text) => updateField('password', text)} error={errors.password} autoComplete="new-password" secureTextEntry editable={!isSubmitting} />
          <AuthInput label="Confirm password" value={values.confirmPassword} onChangeText={(text) => updateField('confirmPassword', text)} error={errors.confirmPassword} autoComplete="new-password" secureTextEntry editable={!isSubmitting} />

          <TurnstileVerification ref={verificationRef} onTokenChange={setVerificationToken} />

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting || (Platform.OS === 'web' && !verificationToken), busy: isSubmitting }} disabled={isSubmitting || (Platform.OS === 'web' && !verificationToken)} onPress={handleSubmit} style={({ pressed }) => [authStyles.button, (isSubmitting || (Platform.OS === 'web' && !verificationToken)) && authStyles.buttonDisabled, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>{isSubmitting ? 'Creating account...' : 'Create account'}</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={[authStyles.result, feedback.kind === 'error' && authStyles.resultError]}>{feedback.message}</Text> : null}
        </View>
        <AuthNavigation current="signup" />
      </View>
    </ScrollView>
  );
}
