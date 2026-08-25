import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ChatSessionSummary } from '@/hooks/use-chat-sessions';

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SessionListItem({ session }: { session: ChatSessionSummary }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(app)/chats/[id]', params: { id: session.id } })}
      className="active:bg-accent border-border flex-row items-center gap-3 border-b px-4 py-3">
      <View className="bg-primary/10 size-10 items-center justify-center rounded-full">
        <Icon as={MessageCircle} className="text-primary" size={18} />
      </View>
      <View className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {session.title}
        </Text>
        <Text variant="muted" className="text-xs">
          {session.message_count} messages · {formatRelativeTime(session.updated_at)}
        </Text>
      </View>
    </Pressable>
  );
}
