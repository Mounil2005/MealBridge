import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Body, Button, Empty, Loading, Screen } from '@/components/ui';
import { signOut } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';

// Shows a retry screen instead of a blank crash if any screen throws while rendering.
export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading />;

  // Signed in but no profile row: the signup trigger failed or the row was removed.
  if (session && !profile) {
    return (
      <Screen>
        <Empty title="Account setup incomplete" hint="We could not load your profile." />
        <Body muted>Try signing out and back in.</Body>
        <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
      </Screen>
    );
  }

  const isDonor = profile?.role === 'donor';
  const isOrg = profile?.role === 'org';
  const isAdmin = profile?.role === 'admin';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isDonor}>
        <Stack.Screen name="donor" />
      </Stack.Protected>
      <Stack.Protected guard={isOrg}>
        <Stack.Screen name="org" />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="donation/[id]" options={{ headerShown: true, title: 'Donation' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
