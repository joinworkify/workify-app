import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { parseAuthRedirect } from '@/lib/auth-redirect';
import { useAuth } from '@/lib/auth-context';

export default function AuthCallbackScreen() {
  const url = useLinkingURL();
  const { completeAuthCallback } = useAuth();
  const handledUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;

    const parsed = parseAuthRedirect(url);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    completeAuthCallback(parsed.params)
      .then(({ error: callbackError }) => {
        if (callbackError) {
          setError(callbackError.message);
          return;
        }
        // '/' (not '/(app)/chats' directly) -- landing on this screen via a cold deep link
        // doesn't reliably leave the (app)/(auth) Stack.Protected groups resolvable for a
        // direct imperative replace into one of them. app/index.tsx already does this exact
        // session-based routing declaratively via <Redirect>, so bounce through there instead.
        router.replace('/');
      })
      .catch((callbackError: unknown) => {
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : 'Unable to complete account confirmation.'
        );
      });
  }, [url, completeAuthCallback]);

  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        {error ? (
          <>
            <Text variant="h3" className="text-center">
              Unable to confirm your account
            </Text>
            <Text className="text-destructive text-center">{error}</Text>
            <Button variant="outline" onPress={() => router.replace('/')}>
              <Text>Back to sign in</Text>
            </Button>
          </>
        ) : (
          <>
            <ActivityIndicator />
            <Text>Confirming your account…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
