import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { LibraryCapacity } from '@/lib/manuals/types';
import { cn } from '@/lib/utils';

// Same shape as components/org/usage-bar.tsx, but for pages instead of AI answers -- mirrors
// workify-web's OrgOverview "Library Capacity" card.
export function CapacityBar({ capacity }: { capacity: LibraryCapacity }) {
  const pct = capacity.limitPages > 0 ? Math.min(capacity.usedPages / capacity.limitPages, 1) : 0;
  const isOverThreshold = pct >= 0.8;

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text variant="muted">Library capacity</Text>
        <Text variant="muted">
          {capacity.usedPages}/{capacity.limitPages} pages
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
