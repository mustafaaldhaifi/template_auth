import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { authStyles } from '../theme/authStyles';

type AuthSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  isSubmitting: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Shows a consistent submit action and progress state across authentication forms. */
export default function AuthSubmitButton({
  label,
  pendingLabel,
  isSubmitting,
  disabled = false,
  onPress,
}: AuthSubmitButtonProps) {
  const unavailable = disabled || isSubmitting;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: isSubmitting }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        authStyles.button,
        unavailable && authStyles.buttonDisabled,
        pressed && authStyles.buttonPressed,
      ]}
    >
      <View style={authStyles.buttonContent}>
        {isSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text style={authStyles.buttonText}>{isSubmitting ? pendingLabel : label}</Text>
      </View>
    </Pressable>
  );
}
