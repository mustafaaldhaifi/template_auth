import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import AuthInput from '../components/AuthInput';
import AuthChoiceTabs from '../components/AuthChoiceTabs';
import AuthNavigation from '../components/AuthNavigation';
import AuthScreen from '../components/AuthScreen';
import AuthSubmitButton from '../components/AuthSubmitButton';
import PhoneNumberField, { defaultPhoneCountry, type PhoneCountry } from '../components/PhoneNumberField';
import TurnstileVerification from '../components/TurnstileVerification';
import VerificationCodeForm from '../components/VerificationCodeForm';
import type { TurnstileVerificationHandle } from '../components/TurnstileVerification.types';
import { ApiRequestError } from '../api/client';
import { completePhoneSignup, requestPhoneSignupCode, signup,
  type PhoneSignupValues, type SignupValues } from '../api/signup';
import { authStyles } from '../theme/authStyles';
import { useRateLimitFeedback } from '../hooks/useRateLimitFeedback';

type SignupField = keyof SignupValues;
type PhoneChannel = 'sms' | 'whatsapp';
type SignupErrors = Partial<Record<SignupField | 'phone' | 'code', string>>;
type SignupFeedback = { message: string; kind: 'success' | 'error' } | null;

const signupFields: SignupField[] = ['firstName', 'lastName', 'email', 'password', 'confirmPassword'];
const phoneChannels: { value: PhoneChannel; label: string }[] = [
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'WhatsApp' },
];
const phoneCodeLength = 8;

const initialValues: SignupValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

/**
 * Checks the sign-up fields before sending them to the server.
 * 1. Require both names and validate phone first, or email when phone is empty.
 * 2. Require a password of 8–128 characters and a matching confirmation.
 * 3. Return field-specific messages for the form to display.
 */
function validateSignup(values: SignupValues, phone: string, country: PhoneCountry): SignupErrors {
  const errors: SignupErrors = {};

  // STEP 1: Check the identity fields.
  if (!values.firstName.trim() || values.firstName.trim().length > 100) {
    errors.firstName = 'Enter a first name of up to 100 characters.';
  }
  if (!values.lastName.trim() || values.lastName.trim().length > 100) {
    errors.lastName = 'Enter a last name of up to 100 characters.';
  }
  // NOTE: A phone number takes priority; email can be added later in account settings.
  if (phone) {
    if (phone.length < 4 || !/^\+[1-9]\d{0,3}$/.test(country.dialCode)) {
      errors.phone = 'Enter a phone number and a valid country code.';
    }
  } else if (!/^\S+@\S+\.\S+$/.test(values.email.trim()) || values.email.trim().length > 254) {
    errors.email = 'Enter a valid email address when no phone number is entered.';
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
 * 1. Keep entered values, errors, request progress, and web retry timing in local state.
 * 2. Prefer phone signup when present, otherwise submit email signup with a web proof.
 * 3. Show the result and links to the other pages.
 */
export default function SignupPage() {
  // STEP 1: Track the draft and feedback for the current form session.
  const [values, setValues] = useState<SignupValues>(initialValues);
  const [country, setCountry] = useState<PhoneCountry>(defaultPhoneCountry);
  const [phone, setPhone] = useState('');
  const [phoneChannel, setPhoneChannel] = useState<PhoneChannel>('sms');
  const [phoneStep, setPhoneStep] = useState<'details' | 'code'>('details');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [feedback, setFeedback] = useState<SignupFeedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const verificationRef = useRef<TurnstileVerificationHandle>(null);
  const submissionInFlight = useRef(false);
  const rateLimit = useRateLimitFeedback();

  /** Returns the current phone draft for either stage of the shared signup endpoint. */
  function phoneSignupValues(): PhoneSignupValues {
    return { firstName: values.firstName, lastName: values.lastName,
      countryIso2: country.iso2, phone, channel: phoneChannel,
      password: values.password, confirmPassword: values.confirmPassword };
  }

  /**
   * Updates one field while clearing feedback that is now stale.
   * 1. Save the new field value.
   * 2. Refresh password confirmation feedback and clear the previous result.
   */
  function updateField(field: SignupField, value: string) {
    // STEP 1: Save the edit without changing the other fields.
    setValues((current) => ({ ...current, [field]: value }));

    // STEP 2: Keep a confirmation error aligned with the current password pair.
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === 'password' && values.confirmPassword) {
        if (values.confirmPassword !== value) next.confirmPassword = 'Passwords must match.';
        else delete next.confirmPassword;
      } else if (field === 'confirmPassword' && current.confirmPassword && value !== values.password) {
        next.confirmPassword = 'Passwords must match.';
      }
      return next;
    });
    setFeedback(null);
  }

  /**
   * Validates the selected signup method and processes its current stage.
   * 1. Stop overlapping, rate-limited, or invalid submissions.
   * 2. Request a phone code or send email details to the existing API.
   * 3. Display feedback and reset the consumed web proof after submission.
   */
  async function handleSubmit() {
    // STEP 1: Guard against duplicate taps and invalid fields.
    if (submissionInFlight.current || rateLimit.isBlocked()) return;
    const nextErrors = validateSignup(values, phone, country);
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
      const proof = Platform.OS === 'web' ? { verificationToken, verificationMethod: 'turnstile' as const } : undefined;
      if (phone) {
        await requestPhoneSignupCode(phoneSignupValues(), proof);
        setPhoneStep('code');
        setCode('');
        setFeedback({ kind: 'success', message: `Check your test email for the ${phoneChannel === 'sms' ? 'SMS' : 'WhatsApp'} code.` });
        return;
      }
      await signup(values, proof);
      // STEP 3: Clear the submitted details only after the account exists.
      setValues(initialValues);
      setFeedback({ kind: 'success', message: 'Account created successfully.' });
    } catch (error) {
      // STEP 3: Map server field errors to the matching inputs on failure.
      if (error instanceof ApiRequestError) {
        if (rateLimit.handleRateLimit(error)) {
          setErrors({});
          setFeedback(error.retryAfterSeconds ? null : { kind: 'error', message: error.message });
        } else if (phone && error.code === 'VALIDATION_ERROR' && error.fieldErrors.email) {
          // NOTE: The deployed email-only server rejects phone signup with an email field error.
          setErrors({});
          setFeedback({ kind: 'error', message: 'The connected server does not support phone sign-up yet. Update the server or connect to a local server with the phone changes.' });
        } else {
          const serverErrors: SignupErrors = {};
          for (const field of signupFields) {
            if (error.fieldErrors[field]) serverErrors[field] = error.fieldErrors[field];
          }
          if (error.fieldErrors.phone || error.fieldErrors.countryIso2) {
            serverErrors.phone = error.fieldErrors.phone || error.fieldErrors.countryIso2;
          }
          setErrors(serverErrors);
          setFeedback({ kind: 'error', message: error.message });
        }
      } else {
        setFeedback({ kind: 'error', message: 'Could not create your account. Please try again.' });
      }
    } finally {
      // STEP 4: Let the user submit again after the request finishes.
      verificationRef.current?.reset();
      setVerificationToken('');
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  /** Confirms the test code before a phone-only account is created. */
  async function handlePhoneCode() {
    if (submissionInFlight.current || rateLimit.isBlocked()) return;
    if (code.length !== phoneCodeLength) {
      setErrors({ code: `Enter the ${phoneCodeLength}-digit code.` });
      return;
    }
    if (Platform.OS === 'web' && !verificationToken) {
      setFeedback({ kind: 'error', message: 'Complete the security check again.' });
      return;
    }
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await completePhoneSignup(phoneSignupValues(), code, Platform.OS === 'web'
        ? { verificationToken, verificationMethod: 'turnstile' } : undefined);
      setValues(initialValues);
      setPhone('');
      setCode('');
      setPhoneStep('details');
      setFeedback({ kind: 'success', message: 'Account created successfully.' });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (rateLimit.handleRateLimit(error)) setFeedback(error.retryAfterSeconds ? null : { kind: 'error', message: error.message });
        else {
          setErrors({ code: error.fieldErrors.phoneCode, phone: error.fieldErrors.phone });
          setFeedback({ kind: 'error', message: error.message });
        }
      } else setFeedback({ kind: 'error', message: 'Could not verify the phone code. Please try again.' });
    } finally {
      verificationRef.current?.reset();
      setVerificationToken('');
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  // STEP 3: Render the same responsive form on every supported platform.
  const displayedFeedback: SignupFeedback = rateLimit.waitMessage
    ? { kind: 'error', message: rateLimit.waitMessage }
    : feedback;
  return (
    <AuthScreen title="Create your account">

        {phoneStep === 'code' ? (
          <View style={authStyles.form}>
            <Text style={authStyles.subtitle}>
              Enter the {phoneCodeLength}-digit code for {country.dialCode} {phone} via {phoneChannel === 'sms' ? 'text message' : 'WhatsApp'}.
            </Text>
            <Text style={authStyles.subtitle}>For now, the code is delivered to the test inbox.</Text>
            <TurnstileVerification action="signup" ref={verificationRef} onTokenChange={setVerificationToken} />
            <VerificationCodeForm code={code} codeLength={phoneCodeLength} error={errors.code}
              feedback={displayedFeedback} onCodeChange={(next) => { setCode(next); setErrors({}); setFeedback(null); }}
              isSubmitting={isSubmitting} onVerify={handlePhoneCode} />
            <Pressable accessibilityRole="button" onPress={() => { setPhoneStep('details'); setFeedback(null); }}>
              <Text style={authStyles.result}>Back to phone details</Text>
            </Pressable>
          </View>
        ) : <View style={authStyles.form}>
          <AuthInput label="First name" value={values.firstName} onChangeText={(text) => updateField('firstName', text)} error={errors.firstName} autoComplete="given-name" autoCapitalize="words" editable={!isSubmitting} />
          <AuthInput label="Last name" value={values.lastName} onChangeText={(text) => updateField('lastName', text)} error={errors.lastName} autoComplete="family-name" autoCapitalize="words" editable={!isSubmitting} />
          <PhoneNumberField country={country} onCountryChange={(next) => { setCountry(next); setErrors({}); setFeedback(null); }}
            number={phone} onNumberChange={(next) => { setPhone(next); setErrors({}); setFeedback(null); }}
            error={errors.phone} editable={!isSubmitting} />
          <AuthInput label="Email address (optional with phone)" value={values.email}
            onChangeText={(text) => updateField('email', text)} error={phone ? undefined : errors.email}
            autoComplete="email" keyboardType="email-address" editable={!isSubmitting} />
          <Text style={authStyles.subtitle}>If you enter a phone number, it takes priority. You can add an email in account settings later.</Text>
          {phone ? <>
            <Text style={authStyles.subtitle}>Send the verification code by</Text>
            <AuthChoiceTabs label="Phone verification channel" options={phoneChannels} value={phoneChannel}
              onChange={(next) => { setPhoneChannel(next); setFeedback(null); }} disabled={isSubmitting} />
          </> : null}
          <AuthInput label="Password" value={values.password} onChangeText={(text) => updateField('password', text)} error={errors.password} autoComplete="new-password" secureTextEntry editable={!isSubmitting} />
          <AuthInput label="Confirm password" value={values.confirmPassword} onChangeText={(text) => updateField('confirmPassword', text)} error={errors.confirmPassword} autoComplete="new-password" secureTextEntry editable={!isSubmitting} />

          <TurnstileVerification action="signup" ref={verificationRef} onTokenChange={setVerificationToken} />

          <AuthSubmitButton label={phone ? 'Send verification code' : 'Create account'} pendingLabel={phone ? 'Sending code...' : 'Creating account...'} isSubmitting={isSubmitting} disabled={(Platform.OS === 'web' && !verificationToken) || rateLimit.remainingSeconds > 0} onPress={handleSubmit} />
          {displayedFeedback ? <Text accessibilityRole="alert" style={[authStyles.result, displayedFeedback.kind === 'error' && authStyles.resultError]}>{displayedFeedback.message}</Text> : null}
        </View>}
        <AuthNavigation current="signup" />
    </AuthScreen>
  );
}
