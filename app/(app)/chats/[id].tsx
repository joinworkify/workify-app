import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/chat/chat-input';
import { ManualPicker } from '@/components/chat/manual-picker';
import { MessageBubble } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Text } from '@/components/ui/text';
import { useChatSession } from '@/hooks/use-chat-sessions';
import { useManuals } from '@/hooks/use-manuals';
import { RagChatError, sendRagChatMessage } from '@/lib/rag/client';
import type { ChatNode } from '@/lib/rag/types';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// sys-rag runs on a free Render dyno that sleeps when idle -- fire this on mount, ignore the
// result, just to start waking it before the user finishes typing their first question.
function pingRagHealth() {
  fetch('https://syspare-rag-py.onrender.com/health').catch(() => {});
}

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, appendAndPersist, updateManualId } = useChatSession(id);
  const { manuals, defaultManualId } = useManuals();
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pingRagHealth();
  }, []);

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
        // sys-rag cites retrieved figures/chunks inline as "[Image 1]", "[Manual Clip 2]", or
        // combinations of both -- we show every returned image as a gallery below the bubble
        // rather than matching citations to specific images (unlike workify-web's
        // citation-filtered/linked version), so strip the raw markers instead of leaving
        // dangling bracket text with no link behind it.
        content: response.answer
          .replace(/\[[^[\]]*\b(?:image|manual\s*clip)[^[\]]*\]/gi, '')
          .replace(/[ \t]{2,}/g, ' ')
          .trim(),
        images: response.images,
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

  const selectedManualId = session.manual_id ?? defaultManualId;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen
        options={{
          headerRight: () =>
            manuals.length > 0 ? (
              <ManualPicker
                manuals={manuals}
                selectedManualId={selectedManualId}
                onSelect={updateManualId}
              />
            ) : null,
        }}
      />
      <SafeAreaView edges={['bottom']} className="bg-background flex-1">
        <FlatList
          className="flex-1"
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
