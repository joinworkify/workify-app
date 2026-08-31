import { Link, router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHero } from '@/components/auth/auth-hero';
import { PasswordRequirements, passwordMeetsRequirements } from '@/components/auth/password-requirements';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth-context';
import { bootstrapOrganization } from '@/lib/organizations';

export default function SignUpScreen() {
  const { signUpWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <SafeAreaView edges={['bottom']} className="bg-background rounded-t-xl">
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
                className="h-12 rounded-lg"
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
                  className="bg-muted h-12 rounded-lg border-0"
                />
              </View>
              <View className="gap-2">
                <Label nativeID="password">Password</Label>
                <View className="justify-center">
                  <Input
                    aria-labelledby="password"
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    secureTextEntry={!showPassword}
                    placeholder="At least 8 characters"
                    className="bg-muted h-12 rounded-lg border-0 pr-11"
                  />
                  <Pressable
                    onPress={() => setShowPassword((value) => !value)}
                    hitSlop={8}
                    className="absolute inset-y-0 right-3 justify-center"
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                    <Icon as={showPassword ? EyeOff : Eye} size={20} className="text-muted-foreground" />
                  </Pressable>
                </View>
                {password.length > 0 ? (
                  <PasswordRequirements password={password} />
                ) : null}
              </View>
              {error ? (
                <Text className="text-destructive" variant="small">
                  {error}
                </Text>
              ) : null}
              <Button
                onPress={handleSignUp}
                disabled={isSubmitting || !email || !passwordMeetsRequirements(password)}
                className="mt-2 h-12 rounded-lg">
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
