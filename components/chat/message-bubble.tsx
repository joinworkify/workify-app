import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { ChatNode } from '@/lib/rag/types';

export function MessageBubble({ node }: { node: ChatNode }) {
  const isUser = node.role === 'user';
  return (
    <View className={cn('flex-row px-4 py-1.5', isUser ? 'justify-end' : 'justify-start')}>
      <View
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          isUser ? 'bg-primary rounded-br-sm' : 'bg-card border-border border rounded-bl-sm'
        )}>
        <Text className={isUser ? 'text-primary-foreground' : 'text-card-foreground'}>
          {node.content}
        </Text>
      </View>
    </View>
  );
}
