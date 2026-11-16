import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

const colors = {
  background: '#F5F7F4',
  card: '#FFFFFF',
  ink: '#172E28',
  muted: '#587067',
  border: '#CEDBD3',
  accent: '#146B4B',
  error: '#B42318',
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

type SignupInputProps = {
  label: string;
  field: SignupField;
  value: string;
  onChange: (field: SignupField, value: string) => void;
  error?: string;
  autoComplete?: 'given-name' | 'family-name' | 'email' | 'new-password';
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
};

function SignupInput({
  label,
  field,
  value,
  onChange,
  error,
  autoComplete,
  keyboardType = 'default',
  secureTextEntry = false,
}: SignupInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCapitalize={field === 'firstName' || field === 'lastName' ? 'words' : 'none'}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={(text) => onChange(field, text)}
        placeholder={label}
        placeholderTextColor="#82958B"
        secureTextEntry={secureTextEntry}
        style={[styles.input, error && styles.inputError]}
        value={value}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
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
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.mark}><Text style={styles.markText}>A</Text></View>
        <Text style={styles.eyebrow}>GET STARTED</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Enter your details to get ready for your new account.</Text>

        <View style={styles.form}>
          <SignupInput label="First name" field="firstName" value={values.firstName} onChange={updateField} error={errors.firstName} autoComplete="given-name" />
          <SignupInput label="Last name" field="lastName" value={values.lastName} onChange={updateField} error={errors.lastName} autoComplete="family-name" />
          <SignupInput label="Email address" field="email" value={values.email} onChange={updateField} error={errors.email} autoComplete="email" keyboardType="email-address" />
          <SignupInput label="Password" field="password" value={values.password} onChange={updateField} error={errors.password} autoComplete="new-password" secureTextEntry />
          <SignupInput label="Confirm password" field="confirmPassword" value={values.confirmPassword} onChange={updateField} error={errors.confirmPassword} autoComplete="new-password" secureTextEntry />

          <Pressable accessibilityRole="button" onPress={handleSubmit} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Create account</Text>
          </Pressable>
          {result ? <Text accessibilityRole="alert" style={[styles.result, Object.keys(errors).length > 0 && styles.resultError]}>{result}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingHorizontal: 20, paddingVertical: 48 },
  card: { width: '100%', maxWidth: 480, paddingHorizontal: 28, paddingVertical: 34, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 24, shadowColor: colors.ink, shadowOpacity: 0.07, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  mark: { alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 13, backgroundColor: colors.accent, marginBottom: 24 },
  markText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '700', lineHeight: 36 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  form: { marginTop: 28 },
  field: { marginBottom: 16 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#FFFFFF', color: colors.ink, fontSize: 16 },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 13, marginTop: 6 },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 50, marginTop: 6, backgroundColor: colors.accent, borderRadius: 10 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  result: { color: colors.accent, fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: 'center' },
  resultError: { color: colors.error },
});
