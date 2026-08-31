import { router } from 'expo-router';
import { Archive, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionListItem } from '@/components/chat/session-list-item';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useChatSessions } from '@/hooks/use-chat-sessions';

export default function ChatsIndexScreen() {
  const { sessions, isLoading, isRefreshing, refresh, createSession, archiveSession } =
    useChatSessions();
  const [isCreating, setIsCreating] = useState(false);

  async function handleNewChat() {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const id = await createSession();
      router.push({ pathname: '/(app)/chats/[id]', params: { id } });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} className="bg-background flex-1">
      {isLoading ? (
        <View className="gap-3 p-4">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </View>
      ) : sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text variant="h4">No chats yet</Text>
          <Text variant="muted" className="text-center">
            Start a new conversation to ask about your equipment manuals.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionListItem
              session={item}
              actions={[
                {
                  label: 'Archive',
                  icon: Archive,
                  onPress: () => archiveSession(item.id),
                },
              ]}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={handleNewChat}
        disabled={isCreating}
        className="bg-primary active:bg-primary/90 absolute bottom-6 right-6 size-14 items-center justify-center rounded-full shadow-lg shadow-black/20">
        <Icon as={Plus} className="text-primary-foreground" size={26} />
      </Pressable>
    </SafeAreaView>
  );
}
