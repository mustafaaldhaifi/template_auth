import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import AuthInput from '../components/AuthInput';
import { authStyles } from '../theme/authStyles';

type SignupField = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword';
type SignupValues = Record<SignupField, string>;
type SignupErrors = Partial<Record<SignupField, string>>;

const initialValues: SignupValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

/**
 * Checks the sign-up fields before displaying a local form result.
 * 1. Require both names and a valid email address.
 * 2. Require a password of at least eight characters and a matching confirmation.
 * 3. Return field-specific messages for the form to display.
 */
function validateSignup(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {};

  // STEP 1: Check the identity fields.
  if (!values.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!values.lastName.trim()) errors.lastName = 'Enter your last name.';
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  // STEP 2: Check the password and confirmation.
  if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }
  if (!values.confirmPassword || values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords must match.';
  }

  // STEP 3: Let the screen show errors next to their fields.
  return errors;
}
/**
 * Presents the shared sign-up form on web, Android, and iOS.
 * 1. Keep entered values and field errors in local state.
 * 2. Validate on submit and show field-specific errors when needed.
 * 3. Show an honest readiness message until account creation is implemented.
 */
export default function SignupPage() {
  // STEP 1: Track the draft and feedback for the current form session.
  const [values, setValues] = useState<SignupValues>(initialValues);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [result, setResult] = useState('');

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
    setResult('');
  }

  /**
   * Checks the draft and reports its local validation result.
   * 1. Validate all fields and show field errors.
   * 2. Stop if any field is invalid.
   * 3. Report readiness without claiming account creation.
   */
  function handleSubmit() {
    // STEP 1: Validate all fields before reporting the form result.
    const nextErrors = validateSignup(values);
    setErrors(nextErrors);

    // STEP 2: Stop at the first invalid submission and keep feedback visible.
    if (Object.keys(nextErrors).length > 0) {
      setResult('Please correct the highlighted fields.');
      return;
    }

    // STEP 3: Confirm validation without claiming that an account was created.
    setResult('Your details look good. Account creation will be available soon.');
  }

  // STEP 3: Render the same responsive form on every supported platform.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>GET STARTED</Text>
        <Text style={authStyles.title}>Create your account</Text>
        <Text style={authStyles.subtitle}>Enter your details to get ready for your new account.</Text>

        <View style={authStyles.form}>
          <AuthInput label="First name" value={values.firstName} onChangeText={(text) => updateField('firstName', text)} error={errors.firstName} autoComplete="given-name" autoCapitalize="words" />
          <AuthInput label="Last name" value={values.lastName} onChangeText={(text) => updateField('lastName', text)} error={errors.lastName} autoComplete="family-name" autoCapitalize="words" />
          <AuthInput label="Email address" value={values.email} onChangeText={(text) => updateField('email', text)} error={errors.email} autoComplete="email" keyboardType="email-address" />
          <AuthInput label="Password" value={values.password} onChangeText={(text) => updateField('password', text)} error={errors.password} autoComplete="new-password" secureTextEntry />
          <AuthInput label="Confirm password" value={values.confirmPassword} onChangeText={(text) => updateField('confirmPassword', text)} error={errors.confirmPassword} autoComplete="new-password" secureTextEntry />

          <Pressable accessibilityRole="button" onPress={handleSubmit} style={({ pressed }) => [authStyles.button, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>Create account</Text>
          </Pressable>
          {result ? <Text accessibilityRole="alert" style={[authStyles.result, Object.keys(errors).length > 0 && authStyles.resultError]}>{result}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
