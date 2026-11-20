import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { authStyles } from '../theme/authStyles';

type AuthScreenProps = { title: string; subtitle?: string; children: ReactNode };

/** Keeps authentication forms readable and scrollable across screen sizes. */
export default function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  const { width } = useWindowDimensions();
  const compact = width < 400;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={authStyles.screen}>
      <ScrollView
        style={authStyles.screen}
        contentContainerStyle={[authStyles.page, compact && authStyles.pageCompact]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[authStyles.card, compact && authStyles.cardCompact]}>
          <Text style={[authStyles.title, compact && authStyles.titleCompact]}>{title}</Text>
          {subtitle ? <Text style={authStyles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
