import '@/global.css';

import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { NAV_THEME } from '@/lib/theme';

export const unstable_settings = {
  anchor: 'index',
};

function RootNavigator() {
  const { session, isLoading } = useAuth();

  // Session is still resolving from storage — render nothing rather than
  // flashing the wrong group before we know whether the user's signed in.
  if (isLoading) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!!session}>
        {/* title: '' -- without it, the back button on screens pushed from here (e.g.
            archived-chats) falls back to this route's segment name, "(app)", as its label. */}
        <Stack.Screen name="(app)" options={{ headerShown: false, title: '' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="archived-chats" options={{ title: 'Archived Chats' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <PortalHost />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
