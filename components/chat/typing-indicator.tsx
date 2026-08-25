import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { cn } from '@/lib/utils';

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return <Animated.View className="bg-muted-foreground size-2 rounded-full" style={{ opacity }} />;
}

// sys-rag never streams (stream=False, always) -- this fills the wait, not a token cursor.
export function TypingIndicator() {
  return (
    <View className="flex-row justify-start px-4 py-1.5">
      <View className={cn('bg-card border-border flex-row gap-1.5 rounded-2xl border px-4 py-3')}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}
