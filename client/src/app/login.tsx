import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AuthInput from '../components/AuthInput';
import { authStyles } from '../theme/authStyles';

type LoginField = 'email' | 'password';
type LoginValues = Record<LoginField, string>;
type LoginErrors = Partial<Record<LoginField, string>>;

const initialValues: LoginValues = { email: '', password: '' };

/**
 * Checks the two login fields without attempting authentication.
 * 1. Require a valid email address.
 * 2. Require a non-empty password.
 * 3. Return messages associated with the invalid fields.
 */
function validateLogin(values: LoginValues): LoginErrors {
  const errors: LoginErrors = {};

  // STEP 1: Check the email format.
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  // STEP 2: Require a password without imposing sign-up password rules.
  if (!values.password) {
    errors.password = 'Enter your password.';
  }

  // STEP 3: Keep feedback next to the affected fields.
  return errors;
}

/**
 * Presents the login form on web, Android, and iOS.
 * 1. Track email, password, and local feedback.
 * 2. Validate when the user submits the form.
 * 3. Render the result without claiming a session was created.
 */
export default function LoginPage() {
  // STEP 1: Hold only the current form values and feedback.
  const [values, setValues] = useState<LoginValues>(initialValues);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [result, setResult] = useState('');

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
   * Reports the form's local validation result.
   * 1. Validate and display field errors.
   * 2. Stop when either field is invalid.
   * 3. Confirm readiness without authenticating the user.
   */
  function handleSubmit() {
    // STEP 1: Validate the full draft.
    const nextErrors = validateLogin(values);
    setErrors(nextErrors);

    // STEP 2: Keep invalid submissions on the form.
    if (Object.keys(nextErrors).length > 0) {
      setResult('Please correct the highlighted fields.');
      return;
    }

    // STEP 3: Authentication will be added when a login endpoint is planned.
    setResult('Your details look good. Sign-in will be available soon.');
  }

  // STEP 3: Render the login page with the shared authentication design.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>WELCOME BACK</Text>
        <Text style={authStyles.title}>Log in to your account</Text>
        <Text style={authStyles.subtitle}>Enter your email and password to continue.</Text>

        <View style={authStyles.form}>
          <AuthInput
            label="Email address"
            value={values.email}
            onChangeText={(text) => updateField('email', text)}
            error={errors.email}
            autoComplete="email"
            keyboardType="email-address"
          />
          <AuthInput
            label="Password"
            value={values.password}
            onChangeText={(text) => updateField('password', text)}
            error={errors.password}
            autoComplete="current-password"
            secureTextEntry
          />

          <Pressable accessibilityRole="button" onPress={handleSubmit} style={({ pressed }) => [authStyles.button, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>Log in</Text>
          </Pressable>
          {result ? <Text accessibilityRole="alert" style={[authStyles.result, Object.keys(errors).length > 0 && authStyles.resultError]}>{result}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
