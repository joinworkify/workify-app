import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
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

// Percentage heights don't reliably resolve inside this Dialog's FullWindowOverlay (same lesson
// as the image viewer's caption ScrollView) -- DialogContent's own `max-h-[80%]` was collapsing
// to a shorter-than-intended box, clipping/overlapping its header and rows. Width is handled by
// DialogContent's own default now (components/ui/dialog.tsx) -- this only needs its own height.
const MAX_LIST_HEIGHT = Dimensions.get('window').height * 0.5;
const DIALOG_MAX_HEIGHT = Dimensions.get('window').height * 0.8;

type ManualPickerProps = {
  manuals: ManualInfo[];
  selectedManualId: string | null;
  onSelect: (manualId: string) => void;
  // Re-fetches the manual list -- called every time this dialog opens, not just once when the
  // chat screen first mounts, so a manual uploaded mid-session (or from the web app) shows up
  // here without needing an app restart.
  onOpen?: () => void;
};

export function ManualPicker({ manuals, selectedManualId, onSelect, onOpen }: ManualPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = manuals.find((manual) => manual.manual_id === selectedManualId);
  const label = selected?.display_name.replace(' Manual', '') ?? 'Select manual';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpen?.();
      }}>
      <DialogTrigger asChild>
        <Pressable
          accessibilityRole="button"
          className="bg-muted active:bg-muted/70 flex-row items-center gap-1 rounded-lg px-3 py-1.5">
          <Text variant="small" className="max-w-32 font-medium" numberOfLines={1}>
            {label}
          </Text>
          <Icon as={ChevronDown} size={14} className="text-muted-foreground" />
        </Pressable>
      </DialogTrigger>
      <DialogContent style={{ maxHeight: DIALOG_MAX_HEIGHT }}>
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
                      // w-full: inside the DialogTrigger's asChild wrapper this otherwise shrinks
                      // to its content's width instead of stretching to the dialog's full width.
                      'w-full flex-row items-center justify-between gap-2 rounded-lg px-3 py-3',
                      isSelected ? 'bg-primary/10' : 'active:bg-muted'
                    )}>
                    <Text
                      className={cn('flex-1', isSelected && 'text-primary font-medium')}
                      numberOfLines={1}>
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
