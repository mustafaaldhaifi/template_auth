import { StyleSheet } from 'react-native';
import { authColors } from './authColors';

export const authStyles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: authColors.background, paddingHorizontal: 20, paddingVertical: 48 },
  card: { width: '100%', maxWidth: 480, paddingHorizontal: 28, paddingVertical: 34, backgroundColor: authColors.card, borderColor: authColors.border, borderWidth: 1, borderRadius: 24, shadowColor: authColors.ink, shadowOpacity: 0.07, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  title: { color: authColors.ink, fontSize: 30, fontWeight: '700', lineHeight: 36 },
  subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  form: { marginTop: 28 },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 50, marginTop: 6, backgroundColor: authColors.accent, borderRadius: 10 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  result: { color: authColors.accent, fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: 'center' },
  resultError: { color: authColors.error },
});
