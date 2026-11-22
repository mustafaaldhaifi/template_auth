import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import AuthInput from '../components/AuthInput';
import AuthNavigation from '../components/AuthNavigation';
import AuthScreen from '../components/AuthScreen';
import AuthSubmitButton from '../components/AuthSubmitButton';
import PhoneNumberField, { defaultPhoneCountry, type PhoneCountry } from '../components/PhoneNumberField';
import TurnstileVerification from '../components/TurnstileVerification';
import type { TurnstileVerificationHandle } from '../components/TurnstileVerification.types';
import { ApiRequestError } from '../api/client';
import { login, type LoginValues } from '../api/auth';
import { authStyles } from '../theme/authStyles';
import { useRateLimitFeedback } from '../hooks/useRateLimitFeedback';

type LoginField = 'email' | 'phone' | 'password';
type LoginErrors = Partial<Record<LoginField, string>>;

const initialValues: LoginValues = { email: '', password: '' };

/**
 * Checks the two login fields before authentication.
 * 1. Validate phone when entered, otherwise require email.
 * 2. Require a non-empty password.
 * 3. Return messages associated with the invalid fields.
 */
function validateLogin(values: LoginValues, phone: string, country: PhoneCountry): LoginErrors {
  const errors: LoginErrors = {};

  // STEP 1: Validate only the visible identifier, leaving the other draft intact.
  if (!phone) {
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim()) || values.email.trim().length > 254) {
      errors.email = 'Enter a valid email address.';
    }
  } else if (phone.length < 4 || !/^\+[1-9]\d{0,3}$/.test(country.dialCode)) {
    errors.phone = 'Enter a phone number and a valid country code.';
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
 * 1. Track credentials, field errors, request progress, and web retry timing.
 * 2. Submit phone first when entered, otherwise email, with the web proof.
 * 3. Navigate to the dashboard after successful login or show feedback.
 */
export default function LoginPage() {
  // STEP 1: Hold only the current form values and feedback.
  const [values, setValues] = useState<LoginValues>(initialValues);
  const [country, setCountry] = useState<PhoneCountry>(defaultPhoneCountry);
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [result, setResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const verificationRef = useRef<TurnstileVerificationHandle>(null);
  const submissionInFlight = useRef(false);
  const router = useRouter();
  const { recovered } = useLocalSearchParams<{ recovered?: string }>();
  const rateLimit = useRateLimitFeedback();

  /**
   * Updates a field and clears feedback that may no longer apply.
   * 1. Save the new field value.
   * 2. Remove that field's error and the previous result.
   */
  function updateField(field: LoginField, value: string) {
    // STEP 1: Preserve the other field while saving the edit.
    if (field === 'phone') setPhone(value);
    else setValues((current) => ({ ...current, [field]: value }));

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
   * 1. Reject duplicate, rate-limited, invalid, or unverified web submissions.
   * 2. Send credentials and navigate after the session is created.
   * 3. Show errors and refresh the consumed web proof when the request ends.
   */
  async function handleSubmit() {
    // STEP 1: Keep an overlapping request from creating multiple sessions.
    if (submissionInFlight.current || rateLimit.isBlocked()) return;
    const nextErrors = validateLogin(values, phone, country);
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
      await login(phone
        ? { method: 'phone', countryIso2: country.iso2, phone, password: values.password }
        : values, Platform.OS === 'web'
        ? { verificationToken, verificationMethod: 'turnstile' }
        : undefined);
      router.replace('/dashboard');
    } catch (error) {
      // STEP 3: Keep the form available with the server's specific feedback.
      if (error instanceof ApiRequestError) {
        if (rateLimit.handleRateLimit(error)) {
          setErrors({});
          setResult(error.retryAfterSeconds ? '' : error.message);
        } else {
          setErrors({ email: error.fieldErrors.email, phone: error.fieldErrors.phone,
            password: error.fieldErrors.password });
          setResult(error.message);
        }
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
    <AuthScreen title="Log in to your account">
        {recovered === '1' && !result && !rateLimit.waitMessage ? (
          <Text accessibilityRole="alert" style={authStyles.result}>
            Password updated. Sign in with your new password.
          </Text>
        ) : null}

        <View style={authStyles.form}>
          <PhoneNumberField country={country} onCountryChange={(next) => { setCountry(next); setErrors({}); setResult(''); }}
            number={phone} onNumberChange={(next) => updateField('phone', next)} error={errors.phone}
            editable={!isSubmitting} />
          <AuthInput
            label="Email address (optional with phone)"
            value={values.email}
            onChangeText={(text) => updateField('email', text)}
            error={errors.email}
            autoComplete="email"
            keyboardType="email-address"
            editable={!isSubmitting}
          />
          <Text style={authStyles.subtitle}>A phone number takes priority when both are entered.</Text>
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

          <AuthSubmitButton label="Log in" pendingLabel="Logging in..." isSubmitting={isSubmitting} disabled={(Platform.OS === 'web' && !verificationToken) || rateLimit.remainingSeconds > 0} onPress={handleSubmit} />
          {rateLimit.waitMessage || result ? <Text accessibilityRole="alert" style={[authStyles.result, authStyles.resultError]}>{rateLimit.waitMessage || result}</Text> : null}
        </View>
        <AuthNavigation current="login" />
    </AuthScreen>
  );
}
