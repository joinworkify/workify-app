import { Stack } from 'expo-router';
import { ArchiveRestore, Trash2 } from 'lucide-react-native';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SessionListItem } from '@/components/chat/session-list-item';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useArchivedSessions } from '@/hooks/use-chat-sessions';

export default function ArchivedChatsScreen() {
  const { sessions, isLoading, isRefreshing, refresh, unarchiveSession, deleteSession } =
    useArchivedSessions();

  return (
    <>
      <Stack.Screen options={{ title: 'Archived Chats' }} />
      <SafeAreaView edges={['bottom']} className="bg-background flex-1">
        {isLoading ? (
          <View className="gap-3 p-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </View>
        ) : sessions.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-2 px-8">
            <Text variant="h4">No archived chats</Text>
            <Text variant="muted" className="text-center">
              Chats you archive from the Chats tab will show up here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
            renderItem={({ item }) => (
              <SessionListItem
                session={item}
                actions={[
                  {
                    label: 'Unarchive',
                    icon: ArchiveRestore,
                    onPress: () => unarchiveSession(item.id),
                  },
                  {
                    label: 'Delete',
                    icon: Trash2,
                    destructive: true,
                    confirmTitle: 'Delete this chat?',
                    confirmDescription: 'This permanently deletes the conversation. This cannot be undone.',
                    onPress: () => deleteSession(item.id),
                  },
                ]}
              />
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}
