import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHero } from '@/components/auth/auth-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth-context';

export default function SignInScreen() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signInWithPassword(email.trim(), password);
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/(app)/chats');
  }

  return (
    <KeyboardAvoidingView
      className="bg-primary flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top']} className="flex-1">
        <AuthHero />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} className="bg-background rounded-t-3xl">
        <View className="px-6 pb-8 pt-8">
          <Text variant="h3">Welcome back</Text>
          <Text variant="muted" className="mt-1">
            Sign in to your Workify account
          </Text>

          <View className="mt-6 gap-4">
            <View className="gap-2">
              <Label nativeID="email">Email</Label>
              <Input
                aria-labelledby="email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@company.com"
                className="bg-muted h-12 rounded-xl border-0"
              />
            </View>
            <View className="gap-2">
              <Label nativeID="password">Password</Label>
              <Input
                aria-labelledby="password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="password"
                secureTextEntry
                placeholder="••••••••"
                className="bg-muted h-12 rounded-xl border-0"
              />
            </View>
            {error ? (
              <Text className="text-destructive" variant="small">
                {error}
              </Text>
            ) : null}
            <Button
              onPress={handleSignIn}
              disabled={isSubmitting || !email || !password}
              className="mt-2 h-12 rounded-xl">
              <Text className="text-primary-foreground font-semibold">
                {isSubmitting ? 'Signing in…' : 'Log in'}
              </Text>
            </Button>
            <View className="flex-row items-center justify-center gap-1">
              <Text variant="muted">Don&apos;t have an account?</Text>
              <Link href="/(auth)/sign-up" replace>
                <Text className="text-primary font-medium" variant="small">
                  Create one!
                </Text>
              </Link>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
