import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { authColors } from '../theme/authColors';

type AuthInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  keyboardType?: TextInputProps['keyboardType'];
  secureTextEntry?: boolean;
  editable?: boolean;
};

export default function AuthInput({
  label,
  value,
  onChangeText,
  error,
  autoCapitalize = 'none',
  autoComplete,
  keyboardType = 'default',
  secureTextEntry = false,
  editable = true,
}: AuthInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
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

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { color: authColors.ink, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: authColors.border, borderRadius: 10, backgroundColor: authColors.card, color: authColors.ink, fontSize: 16 },
  inputError: { borderColor: authColors.error },
  errorText: { color: authColors.error, fontSize: 13, marginTop: 6 },
});
