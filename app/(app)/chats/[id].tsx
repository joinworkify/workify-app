import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/chat/chat-input';
import { ManualPicker } from '@/components/chat/manual-picker';
import { MessageBubble } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Text } from '@/components/ui/text';
import { useChatSession } from '@/hooks/use-chat-sessions';
import { useManuals } from '@/hooks/use-manuals';
import { dayKey, formatDaySeparator } from '@/lib/chat/format-date';
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

  // First message of each new calendar day (device-local) gets a "Today"/"Yesterday"/date
  // separator rendered above its bubble -- keyed by node id since the list itself renders
  // reversed+inverted for the chat scroll trick.
  const daySeparators = useMemo(() => {
    const separators = new Map<string, string>();
    let lastKey: string | null = null;
    for (const node of session?.nodes ?? []) {
      const key = dayKey(node.createdAt);
      if (key !== lastKey) {
        separators.set(node.id, formatDaySeparator(node.createdAt));
        lastKey = key;
      }
    }
    return separators;
  }, [session?.nodes]);

  useEffect(() => {
    pingRagHealth();
  }, []);

  // Shared by a fresh send and a retry -- the only difference is whether the caller still needs
  // to append the user's node first (a retry's user node is already persisted from the failed
  // attempt, so re-sending it would duplicate the bubble).
  async function submitQuestion(question: string, historyNodes: ChatNode[]) {
    if (!session) return;
    setError(null);
    setIsSending(true);

    const lastNode = historyNodes[historyNodes.length - 1];

    try {
      // sys-rag/Gemini's history wire format uses role 'user' | 'model', not this app's stored
      // 'user' | 'assistant' node role (see ChatNodeRole) -- translate on the way out, and read
      // text from `result.answer` first since that's where an assistant turn's text lives once
      // written in the shared (with workify-web) node shape.
      const history = historyNodes.map((n) => ({
        role: n.role === 'assistant' ? ('model' as const) : ('user' as const),
        content: n.result?.answer ?? n.content ?? '',
      }));

      const response = await sendRagChatMessage({
        session_id: session.id,
        question,
        history,
        manual_id: session.manual_id,
      });

      const modelNode: ChatNode = {
        id: makeId(),
        parentId: lastNode?.id ?? null,
        role: 'assistant',
        question,
        // Stored as workify-web stores it -- raw answer (citation markers like "[Image 1]" and
        // all), so a session either app writes renders correctly in both. Marker-stripping for
        // this app's simpler flat image gallery happens at render time (message-bubble.tsx).
        result: response,
        createdAt: new Date().toISOString(),
      };
      await appendAndPersist(modelNode);
    } catch (err) {
      if (err instanceof RagChatError && err.code === 'no_organization') {
        setError("Your account isn't set up yet. Try signing out and back in.");
      } else if (
        err instanceof RagChatError &&
        (err.code === 'ai_answer_limit_reached' || err.code === 'organization_inactive')
      ) {
        setError(err.message);
      } else {
        setError('Something went wrong sending that message.');
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleSend() {
    const question = draft.trim();
    if (!question || isSending || !session) return;

    setDraft('');
    setError(null);

    const lastNode = session.nodes[session.nodes.length - 1];
    const userNode: ChatNode = {
      id: makeId(),
      parentId: lastNode?.id ?? null,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };

    try {
      await appendAndPersist(userNode);
    } catch {
      // Never made it into the session -- give the draft back rather than silently losing it.
      setDraft(question);
      setError('Failed to send your message. Check your connection and try again.');
      return;
    }

    await submitQuestion(question, [...session.nodes, userNode]);
  }

  // Only offered when the most recent node is a user message with no model reply after it --
  // i.e. the question is already saved, just the RAG call (or the model's response) failed.
  const canRetry =
    !!error && !!session && session.nodes[session.nodes.length - 1]?.role === 'user';

  function handleRetry() {
    if (!session || isSending) return;
    const lastNode = session.nodes[session.nodes.length - 1];
    if (!lastNode || lastNode.role !== 'user') return;
    submitQuestion(lastNode.content ?? '', session.nodes);
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
          renderItem={({ item }) => (
            <MessageBubble node={item} dateLabel={daySeparators.get(item.id) ?? null} />
          )}
          contentContainerClassName="py-2"
          ListHeaderComponent={isSending ? <TypingIndicator /> : null}
        />
        {error ? (
          <View className="flex-row items-center justify-between gap-3 px-4 pb-1">
            <Text className="text-destructive flex-1" variant="small">
              {error}
            </Text>
            {canRetry ? (
              <Pressable
                accessibilityRole="button"
                disabled={isSending}
                onPress={handleRetry}
                hitSlop={8}>
                <Text className="text-primary font-medium" variant="small">
                  Retry
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <ChatInput value={draft} onChangeText={setDraft} onSend={handleSend} disabled={isSending} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
