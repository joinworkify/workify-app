import { Link } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function ModalScreen() {
  return (
    <View className="bg-background flex-1 items-center justify-center gap-4 p-5">
      <Text variant="h3">This is a modal</Text>
      <Link href="/(app)/chats" dismissTo>
        <Text className="text-primary">Go to home screen</Text>
      </Link>
    </View>
  );
}
