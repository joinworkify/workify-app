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
import { bootstrapOrganization } from '@/lib/organizations';

export default function SignUpScreen() {
  const { signUpWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignUp() {
    setError(null);
    setIsSubmitting(true);
    const { error: signUpError, needsEmailConfirmation } = await signUpWithPassword(
      email.trim(),
      password
    );
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (needsEmailConfirmation) {
      setCheckEmail(true);
      return;
    }

    // A session came back immediately — this project has email confirmation disabled. Give the
    // new mobile user an org before routing them in.
    await bootstrapOrganization();
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
          <Text variant="h3">Create your account</Text>
          <Text variant="muted" className="mt-1">
            Create your account to start your journey
          </Text>

          {checkEmail ? (
            <View className="mt-6 gap-3">
              <Text variant="p">
                Check <Text className="font-semibold">{email}</Text> for a confirmation link,
                then sign in.
              </Text>
              <Button
                variant="outline"
                className="h-12 rounded-xl"
                onPress={() => router.replace('/(auth)/sign-in')}>
                <Text className="font-semibold">Back to sign in</Text>
              </Button>
            </View>
          ) : (
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
                  autoComplete="password-new"
                  secureTextEntry
                  placeholder="At least 8 characters"
                  className="bg-muted h-12 rounded-xl border-0"
                />
              </View>
              {error ? (
                <Text className="text-destructive" variant="small">
                  {error}
                </Text>
              ) : null}
              <Button
                onPress={handleSignUp}
                disabled={isSubmitting || !email || password.length < 8}
                className="mt-2 h-12 rounded-xl">
                <Text className="text-primary-foreground font-semibold">
                  {isSubmitting ? 'Creating account…' : 'Sign up'}
                </Text>
              </Button>
              <View className="flex-row items-center justify-center gap-1">
                <Text variant="muted">Already have an account?</Text>
                <Link href="/(auth)/sign-in" replace>
                  <Text className="text-primary font-medium" variant="small">
                    Sign in
                  </Text>
                </Link>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
