import { X } from 'lucide-react-native';
import ImageViewing from 'react-native-image-viewing';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ImageMatch } from '@/lib/rag/types';

// Percentage heights don't reliably resolve inside react-native-image-viewing's footer wrapper
// (its own container isn't guaranteed to have a measured height), so cap the caption ScrollView
// with a real pixel value instead.
const MAX_CAPTION_HEIGHT = Dimensions.get('window').height * 0.3;

type ImageViewerProps = {
  images: ImageMatch[];
  index: number | null;
  onChangeIndex: (index: number | null) => void;
};

// react-native-image-viewing gives us pinch/double-tap zoom and swipe-between-images for free
// (battle-tested gesture math we don't want to hand-roll) -- we only supply the header/footer
// chrome (close button, index/doc/page info, scrollable caption).
export function ImageViewer({ images, index, onChangeIndex }: ImageViewerProps) {
  return (
    <ImageViewing
      images={images.map((image) => ({ uri: image.img_url }))}
      imageIndex={index ?? 0}
      visible={index !== null}
      onRequestClose={() => onChangeIndex(null)}
      // react-native-image-viewing's own effect calls this unconditionally on mount (its hooks
      // run before its `if (!visible) return null` check), even while `visible` is false -- so
      // an unguarded pass-through here fires with index 0 the moment any message with images
      // mounts and pops the viewer open on its own. Only forward real swipe-navigation while the
      // viewer is actually open.
      onImageIndexChange={(newIndex) => {
        if (index !== null) onChangeIndex(newIndex);
      }}
      backgroundColor="#000000"
      HeaderComponent={({ imageIndex }) => (
        // Header/footer float directly over the image, so they need their own opaque
        // background -- without it, bright image content behind the text collapses contrast
        // (e.g. a scanned manual page with a white background right at the seam).
        <SafeAreaView edges={['top']} className="bg-black">
          <View className="flex-row items-center justify-between px-4 py-2">
            <Text className="text-white" variant="small">
              {imageIndex + 1} / {images.length}
              {images[imageIndex]?.doc ? ` · ${images[imageIndex].doc}` : ''}
              {images[imageIndex]?.page != null ? ` p${images[imageIndex].page}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onChangeIndex(null)}
              hitSlop={8}
              className="rounded-full bg-white/10 p-2">
              <Icon as={X} size={18} className="text-white" />
            </Pressable>
          </View>
        </SafeAreaView>
      )}
      FooterComponent={({ imageIndex }) =>
        images[imageIndex]?.caption ? (
          <SafeAreaView edges={['bottom']} className="bg-black">
            <ScrollView
              style={{ maxHeight: MAX_CAPTION_HEIGHT }}
              className="px-4 pt-2"
              contentContainerClassName="pb-4">
              <Text className="text-white/80" variant="small">
                {images[imageIndex].caption}
              </Text>
            </ScrollView>
          </SafeAreaView>
        ) : (
          <View />
        )
      }
    />
  );
}
