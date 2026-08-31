import { Image } from 'expo-image';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import Markdown from 'react-native-markdown-display';
import { Pressable, ScrollView, View } from 'react-native';

import { ImageViewer } from '@/components/chat/image-viewer';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { ChatNode } from '@/lib/rag/types';

export function MessageBubble({ node }: { node: ChatNode }) {
  const isUser = node.role === 'user';
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const images = node.images ?? [];

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
          {node.content}
        </Markdown>

        {images.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1 mt-2"
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
        ) : null}
      </View>

      {images.length > 0 ? (
        <ImageViewer images={images} index={viewerIndex} onChangeIndex={setViewerIndex} />
      ) : null}
    </View>
  );
}
