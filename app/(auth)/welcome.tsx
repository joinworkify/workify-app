import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHero } from '@/components/auth/auth-hero';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function WelcomeScreen() {
  return (
    <View className="bg-primary flex-1">
      <SafeAreaView className="flex-1">
        <AuthHero />
        <View className="mt-6 items-center px-8">
          <Text className="text-primary-foreground text-5xl font-extrabold tracking-tight">
            Workify
          </Text>
          <Text className="text-primary-foreground/80 mt-3 text-center" variant="p">
            Get instant answers from your equipment manuals — anywhere, anytime.
          </Text>
        </View>
        <View className="flex-1" />
        <View className="gap-3 px-6 pb-8">
          <Button
            className="bg-background h-14 rounded-lg"
            onPress={() => router.push('/(auth)/sign-in')}>
            <Text className="text-primary text-base font-semibold">Log in</Text>
          </Button>
          <Button
            variant="ghost"
            className="bg-primary-foreground/15 h-14 rounded-lg"
            onPress={() => router.push('/(auth)/sign-up')}>
            <Text className="text-primary-foreground text-base font-semibold">
              Create a new account
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}
