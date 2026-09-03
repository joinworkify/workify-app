import { router } from 'expo-router';
import { Archive, BookText, LogOut } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center gap-6 px-6 pt-12">
        <View className="w-full flex-row justify-end">
          <ThemeToggle />
        </View>
        <Avatar alt={user?.email ?? 'User avatar'} className="size-20">
          <AvatarFallback>
            <Text variant="h3" className="text-primary">
              {initial}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="items-center gap-1">
          <Text variant="large">{user?.email}</Text>
          <Text variant="muted">Signed in</Text>
        </View>
        <Button
          variant="outline"
          onPress={() => router.push('/manuals')}
          className="mt-4 w-full">
          <Icon as={BookText} size={16} />
          <Text>Manage manuals</Text>
        </Button>
        <Button variant="outline" onPress={() => router.push('/archived-chats')} className="w-full">
          <Icon as={Archive} size={16} />
          <Text>Archived chats</Text>
        </Button>
        <Button variant="outline" onPress={signOut} className="w-full">
          <Icon as={LogOut} size={16} />
          <Text>Sign out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
