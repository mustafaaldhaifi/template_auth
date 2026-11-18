import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RecoveryFlowProvider } from '../features/passwordRecovery/RecoveryFlowContext';

export default function RootLayout() {
  return (
    <RecoveryFlowProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </RecoveryFlowProvider>
  );
}
