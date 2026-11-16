import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AuthInput from '../components/AuthInput';
import { authStyles } from '../theme/authStyles';

/**
 * Presents the password recovery placeholder on web, Android, and iOS.
 * 1. Track the email address and local feedback.
 * 2. Validate the email when the user presses Send Reset Link.
 * 3. Explain that no reset email is sent yet.
 */
export default function ForgotPasswordPage() {
  // STEP 1: Keep the entered email and form feedback local to this screen.
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  /**
   * Saves the email draft and clears outdated feedback.
   * 1. Update the email value.
   * 2. Clear the previous validation error and result.
   */
  function updateEmail(value: string) {
    // STEP 1: Save the current draft.
    setEmail(value);

    // STEP 2: Clear feedback that described the previous draft.
    setError('');
    setResult('');
  }

  /**
   * Validates the email and reports the placeholder result.
   * 1. Reject an empty or malformed email.
   * 2. Show a local readiness message for a valid email.
   */
  function handleSendResetLink() {
    // STEP 1: Keep invalid addresses on the form with field feedback.
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      setResult('');
      return;
    }

    // STEP 2: The button is a placeholder and must not imply an email was sent.
    setError('');
    setResult('Your email looks good. Reset link delivery will be available soon.');
  }

  // STEP 3: Render the page with the shared authentication design.
  return (
    <ScrollView contentContainerStyle={authStyles.page} keyboardShouldPersistTaps="handled">
      <View style={authStyles.card}>
        <View style={authStyles.mark}><Text style={authStyles.markText}>A</Text></View>
        <Text style={authStyles.eyebrow}>ACCOUNT RECOVERY</Text>
        <Text style={authStyles.title}>Forgot your password?</Text>
        <Text style={authStyles.subtitle}>Enter your email address to prepare a password reset request.</Text>

        <View style={authStyles.form}>
          <AuthInput
            label="Email address"
            value={email}
            onChangeText={updateEmail}
            error={error}
            autoComplete="email"
            keyboardType="email-address"
          />

          <Pressable accessibilityRole="button" onPress={handleSendResetLink} style={({ pressed }) => [authStyles.button, pressed && authStyles.buttonPressed]}>
            <Text style={authStyles.buttonText}>Send Reset Link</Text>
          </Pressable>
          {result ? <Text accessibilityRole="alert" style={authStyles.result}>{result}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
