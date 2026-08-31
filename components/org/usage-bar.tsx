import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { SeatUsage } from '@/lib/org/types';

export function UsageBar({ usage, label }: { usage: SeatUsage; label: string }) {
  const pct = usage.allowance > 0 ? Math.min(usage.used / usage.allowance, 1) : 0;
  const isOverThreshold = pct >= 0.8;

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text variant="muted">{label}</Text>
        <Text variant="muted">
          {usage.used}/{usage.allowance} answers
        </Text>
      </View>
      <View className="bg-muted h-1.5 overflow-hidden rounded-full">
        <View
          className={cn('h-full rounded-full', isOverThreshold ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${pct * 100}%` }}
        />
      </View>
    </View>
  );
}
