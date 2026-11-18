import { Pressable, Text, View } from 'react-native';
import AuthInput from './AuthInput';
import { authStyles } from '../theme/authStyles';

export type VerificationCodeFeedback = {
  message: string;
  kind: 'success' | 'error';
} | null;

type VerificationCodeFormProps = {
  code: string;
  codeLength: number;
  error?: string;
  feedback?: VerificationCodeFeedback;
  isSubmitting?: boolean;
  onCodeChange: (code: string) => void;
  onVerify: () => void;
};

/** Presents a channel-independent code field and verification action. */
export default function VerificationCodeForm({
  code,
  codeLength,
  error,
  feedback = null,
  isSubmitting = false,
  onCodeChange,
  onVerify,
}: VerificationCodeFormProps) {
  return (
    <View style={authStyles.form}>
      <AuthInput
        label="Verification code"
        value={code}
        onChangeText={(text) => onCodeChange(text.replace(/\D/g, '').slice(0, codeLength))}
        error={error}
        autoComplete="one-time-code"
        keyboardType="number-pad"
        maxLength={codeLength}
        editable={!isSubmitting}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
        disabled={isSubmitting}
        onPress={onVerify}
        style={({ pressed }) => [
          authStyles.button,
          isSubmitting && authStyles.buttonDisabled,
          pressed && authStyles.buttonPressed,
        ]}
      >
        <Text style={authStyles.buttonText}>{isSubmitting ? 'Verifying...' : 'Verify code'}</Text>
      </Pressable>
      {feedback ? (
        <Text accessibilityRole="alert" style={[authStyles.result, feedback.kind === 'error' && authStyles.resultError]}>
          {feedback.message}
        </Text>
      ) : null}
    </View>
  );
}
