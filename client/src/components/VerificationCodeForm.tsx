import { Text, View } from 'react-native';
import AuthInput from './AuthInput';
import AuthSubmitButton from './AuthSubmitButton';
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

      <AuthSubmitButton label="Verify code" pendingLabel="Verifying..." isSubmitting={isSubmitting} onPress={onVerify} />
      {feedback ? (
        <Text accessibilityRole="alert" style={[authStyles.result, feedback.kind === 'error' && authStyles.resultError]}>
          {feedback.message}
        </Text>
      ) : null}
    </View>
  );
}
