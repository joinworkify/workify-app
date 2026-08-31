import { ArrowUp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ChatInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export function ChatInput({ value, onChangeText, onSend, disabled }: ChatInputProps) {
  const canSend = value.trim().length > 0 && !disabled;
  return (
    <View className="border-border bg-background flex-row items-center gap-2 border-t px-3 py-2">
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask about your manual..."
        className="min-h-11 max-h-32 flex-1 rounded-xl"
        editable={!disabled}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={onSend}
        className={cn(
          'bg-primary active:bg-primary/90 size-10 items-center justify-center rounded-full',
          !canSend && 'opacity-40'
        )}>
        <Icon as={ArrowUp} className="text-primary-foreground" size={20} />
      </Pressable>
    </View>
  );
}
