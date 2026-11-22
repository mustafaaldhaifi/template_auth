import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../theme/authColors';

type Choice<T extends string> = { value: T; label: string };

export type AuthIdentifierMethod = 'email' | 'phone';
export const authIdentifierOptions: readonly Choice<AuthIdentifierMethod>[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

type AuthChoiceTabsProps<T extends string> = {
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** Presents the same accessible choice control for identifiers and delivery channels. */
export default function AuthChoiceTabs<T extends string>({
  label, options, value, onChange, disabled = false,
}: AuthChoiceTabsProps<T>) {
  return (
    <View accessibilityLabel={label} style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.choice, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[styles.choiceText, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: 8, marginTop: 22 },
  choice: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
    borderWidth: 1, borderColor: authColors.border, borderRadius: 10, backgroundColor: authColors.card },
  selected: { borderColor: authColors.accent, backgroundColor: authColors.accent },
  pressed: { opacity: 0.8 },
  choiceText: { color: authColors.ink, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  selectedText: { color: '#FFFFFF' },
});
