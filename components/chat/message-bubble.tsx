import { Image } from 'expo-image';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import Markdown from 'react-native-markdown-display';
import { Pressable, ScrollView, View } from 'react-native';

import { ImageViewer } from '@/components/chat/image-viewer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { ChatNode } from '@/lib/rag/types';

// sys-rag cites retrieved figures/chunks inline as "[Image 1]", "[Manual Clip 2]", or
// combinations of both -- this app shows every returned image as a gallery below the bubble
// rather than matching citations to specific images (unlike workify-web's citation-filtered/
// linked version), so strip the raw markers instead of leaving dangling bracket text with no
// link behind it. Stored text keeps the raw markers (matches what workify-web writes/expects);
// this only affects this app's own rendering.
function stripCitationMarkers(text: string) {
  return text
    .replace(/\[[^[\]]*\b(?:image|manual\s*clip)[^[\]]*\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function MessageBubble({ node }: { node: ChatNode }) {
  const isUser = node.role === 'user';
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // `result` is the shared-with-workify-web node shape (see ChatNode); `content`/`images` are
  // this app's old flat shape, kept as a fallback for rows written before nodes were made
  // cross-compatible.
  const rawContent = node.result?.answer ?? node.content ?? '';
  const content = isUser ? rawContent : stripCitationMarkers(rawContent);
  const images = node.result?.images ?? node.images ?? [];
  // Retrieved manual passages backing the answer -- web shows these in a "Retrieved Text
  // Chunks" panel (RagChatResultView.tsx). Only ever comes via `result` (the flat legacy shape
  // this app used to write never carried them), and only this app's own answers have them --
  // there's nothing to show for an older row saved before this field existed.
  const texts = node.result?.texts ?? [];
  const [chunksOpen, setChunksOpen] = useState(false);

  const textColor = isUser ? theme.primaryForeground : theme.cardForeground;
  const mutedColor = isUser ? theme.primaryForeground : theme.mutedForeground;
  const codeBg = isUser ? theme.primary : theme.muted;
  const borderColor = isUser ? theme.primaryForeground : theme.border;

  return (
    <View className={cn('flex-row px-4 py-1.5', isUser ? 'justify-end' : 'justify-start')}>
      <View
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          isUser ? 'bg-primary rounded-br-sm' : 'bg-card border-border border rounded-bl-sm'
        )}>
        <Markdown
          style={{
            body: { color: textColor, fontSize: 16, lineHeight: 22 },
            paragraph: { marginTop: 0, marginBottom: 8, width: '100%' },
            heading1: { color: textColor, fontSize: 20, marginBottom: 6 },
            heading2: { color: textColor, fontSize: 18, marginBottom: 6 },
            heading3: { color: textColor, fontSize: 17, marginBottom: 6 },
            heading4: { color: textColor, fontSize: 16, marginBottom: 4 },
            heading5: { color: textColor, fontSize: 16, marginBottom: 4 },
            heading6: { color: textColor, fontSize: 16, marginBottom: 4 },
            strong: { color: textColor, fontWeight: '700' },
            em: { color: textColor, fontStyle: 'italic' },
            s: { color: textColor },
            bullet_list: { marginBottom: 4 },
            ordered_list: { marginBottom: 4 },
            list_item: { marginBottom: 4 },
            bullet_list_icon: { color: mutedColor, marginRight: 6 },
            ordered_list_icon: { color: mutedColor, marginRight: 6 },
            code_inline: {
              backgroundColor: codeBg,
              color: textColor,
              borderWidth: 0,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 4,
              fontSize: 14,
            },
            code_block: {
              backgroundColor: codeBg,
              borderWidth: 0,
              borderRadius: 8,
              padding: 10,
            },
            fence: {
              backgroundColor: codeBg,
              borderWidth: 0,
              borderRadius: 8,
              padding: 10,
            },
            blockquote: {
              backgroundColor: codeBg,
              borderLeftWidth: 3,
              borderColor,
              paddingHorizontal: 10,
              paddingVertical: 4,
            },
            hr: { backgroundColor: borderColor, height: 1 },
            link: { color: isUser ? theme.primaryForeground : theme.primary },
          }}>
          {content}
        </Markdown>

        {images.length > 0 ? (
          <View className="mt-2">
            <Text variant="small" style={{ color: mutedColor }} className="mb-1 font-medium">
              Reference images
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-1"
              contentContainerClassName="gap-2 px-1">
              {images.map((image, i) => (
                <Pressable
                  key={`${image.img_url}-${i}`}
                  accessibilityRole="button"
                  onPress={() => setViewerIndex(i)}
                  className="overflow-hidden rounded-lg border border-black/10">
                  <Image
                    source={{ uri: image.img_url }}
                    style={{ width: 140, height: 100 }}
                    contentFit="cover"
                    transition={100}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {texts.length > 0 ? (
          <View className="border-border/40 mt-3 border-t pt-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => setChunksOpen((open) => !open)}
              className="flex-row items-center justify-between py-1">
              <Text variant="small" style={{ color: mutedColor }} className="font-medium">
                Retrieved text chunks ({texts.length})
              </Text>
              <Icon as={chunksOpen ? ChevronUp : ChevronDown} size={16} color={mutedColor} />
            </Pressable>
            {chunksOpen ? (
              <View className="mt-1 gap-2">
                {texts.map((chunk, i) => (
                  <View key={i} className="rounded-lg p-2" style={{ backgroundColor: codeBg }}>
                    {chunk.doc || chunk.page != null ? (
                      <Text variant="small" style={{ color: mutedColor }} className="mb-1">
                        {[chunk.doc, chunk.page != null ? `p${chunk.page}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    <Text variant="small" style={{ color: textColor }}>
                      {chunk.chunk_text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {images.length > 0 ? (
        <ImageViewer images={images} index={viewerIndex} onChangeIndex={setViewerIndex} />
      ) : null}
    </View>
  );
}
