import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/chat/chat-input';
import { MessageBubble } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Text } from '@/components/ui/text';
import { useChatSession } from '@/hooks/use-chat-sessions';
import { RagChatError, sendRagChatMessage } from '@/lib/rag/client';
import type { ChatNode } from '@/lib/rag/types';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, appendAndPersist } = useChatSession(id);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const question = draft.trim();
    if (!question || isSending || !session) return;

    setDraft('');
    setError(null);
    setIsSending(true);

    const userNode: ChatNode = {
      id: makeId(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };

    try {
      await appendAndPersist(userNode);

      const history = [...session.nodes, userNode].map((n) => ({
        role: n.role,
        content: n.content,
      }));

      const response = await sendRagChatMessage({
        session_id: session.id,
        question,
        history,
        manual_id: session.manual_id,
      });

      const modelNode: ChatNode = {
        id: makeId(),
        role: 'model',
        content: response.answer,
        createdAt: new Date().toISOString(),
      };
      await appendAndPersist(modelNode);
    } catch (err) {
      if (err instanceof RagChatError && err.code === 'no_organization') {
        setError("Your account isn't set up yet. Try signing out and back in.");
      } else {
        setError('Something went wrong sending that message.');
      }
    } finally {
      setIsSending(false);
    }
  }

  if (!session) return null;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <SafeAreaView edges={['bottom']} className="bg-background flex-1">
        <FlatList
          data={[...session.nodes].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble node={item} />}
          contentContainerClassName="py-2"
          ListHeaderComponent={isSending ? <TypingIndicator /> : null}
        />
        {error ? (
          <View className="px-4 pb-1">
            <Text className="text-destructive" variant="small">
              {error}
            </Text>
          </View>
        ) : null}
        <ChatInput value={draft} onChangeText={setDraft} onSend={handleSend} disabled={isSending} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
