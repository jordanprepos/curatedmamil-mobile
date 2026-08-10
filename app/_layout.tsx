import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/lib/auth';
import { fontMap } from '../src/theme/text';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync();

/**
 * Redirects between the login screen and the app depending on auth state.
 * Rendered inside AuthProvider so it can read the restored session.
 */
function AuthGate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const onLoginScreen = segments[0] === 'masuk';

  useEffect(() => {
    if (!ready) return;
    if (!user && !onLoginScreen) router.replace('/masuk');
    else if (user && onLoginScreen) router.replace('/');
  }, [ready, user, onLoginScreen, router]);

  return null;
}

function RootNavigator() {
  const { ready } = useAuth();
  const [fontsLoaded, fontError] = useFonts(fontMap);

  // Hold the splash until both fonts and the persisted session have resolved,
  // so the app never flashes the login screen at an already-signed-in owner.
  useEffect(() => {
    if ((fontsLoaded || fontError) && ready) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, ready]);

  if ((!fontsLoaded && !fontError) || !ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bgPage }} />;
  }

  return (
    <>
      <AuthGate />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgApp },
        }}
      >
        <Stack.Screen name="masuk" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
