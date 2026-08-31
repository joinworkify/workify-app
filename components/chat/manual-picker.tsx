import { Check, ChevronDown } from 'lucide-react-native';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ManualInfo } from '@/lib/rag/types';
import { cn } from '@/lib/utils';

// Percentage heights don't reliably resolve inside nested flex containers here (same lesson as
// the image viewer's caption ScrollView), so cap the list with a real pixel value instead.
const MAX_LIST_HEIGHT = Dimensions.get('window').height * 0.5;

type ManualPickerProps = {
  manuals: ManualInfo[];
  selectedManualId: string | null;
  onSelect: (manualId: string) => void;
};

export function ManualPicker({ manuals, selectedManualId, onSelect }: ManualPickerProps) {
  const selected = manuals.find((manual) => manual.manual_id === selectedManualId);
  const label = selected?.display_name.replace(' Manual', '') ?? 'Select manual';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Pressable
          accessibilityRole="button"
          className="bg-muted active:bg-muted/70 flex-row items-center gap-1 rounded-full px-3 py-1.5">
          <Text variant="small" className="max-w-32 font-medium" numberOfLines={1}>
            {label}
          </Text>
          <Icon as={ChevronDown} size={14} className="text-muted-foreground" />
        </Pressable>
      </DialogTrigger>
      <DialogContent className="max-h-[80%]">
        <DialogHeader>
          <DialogTitle>Choose a manual</DialogTitle>
        </DialogHeader>
        <ScrollView style={{ maxHeight: MAX_LIST_HEIGHT }} showsVerticalScrollIndicator={false}>
          <View className="gap-1">
            {manuals.map((manual) => {
              const isSelected = manual.manual_id === selectedManualId;
              return (
                <DialogTrigger key={manual.manual_id} asChild>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelect(manual.manual_id)}
                    className={cn(
                      'flex-row items-center justify-between rounded-lg px-3 py-3',
                      isSelected ? 'bg-primary/10' : 'active:bg-muted'
                    )}>
                    <Text className={cn(isSelected && 'text-primary font-medium')}>
                      {manual.display_name}
                    </Text>
                    {isSelected ? <Icon as={Check} size={18} className="text-primary" /> : null}
                  </Pressable>
                </DialogTrigger>
              );
            })}
          </View>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
