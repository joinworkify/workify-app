import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { UploadPhase } from '@/lib/manuals-upload-context';
import { cn } from '@/lib/utils';

// Lives on the Manuals screen (not inside the upload dialog) so progress stays visible after the
// dialog is closed -- the poll loop backing this state lives in ManualsUploadProvider (mounted at
// the app root), not this screen, so it keeps running regardless of navigation.
export function TrainingProgressBanner({
  phase,
  progress,
  message,
  target,
  onDismiss,
}: {
  phase: UploadPhase;
  progress: number;
  message: string;
  target: string | null;
  onDismiss: () => void;
}) {
  if (phase === 'idle' || phase === 'done' || !target) return null;

  const isBusy = phase === 'uploading' || phase === 'training';
  const progressPct = phase === 'uploading' ? 5 : progress;

  return (
    <View className="bg-muted/50 w-full gap-2 rounded-lg p-3">
      <View className="w-full flex-row items-start justify-between gap-2">
        <Text variant="small" className="flex-1 font-medium" numberOfLines={1}>
          {phase === 'error' ? `"${target}" failed to train` : `Training "${target}"...`}
        </Text>
        {/* Lets you dismiss a job that will never reach done/error client-side -- e.g. the
            manual was removed on the backend directly, or the job is simply hung. Dismissing
            only clears this client's view of it; it doesn't touch the RAG backend. */}
        <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}>
          <Icon as={X} size={16} className="text-muted-foreground" />
        </Pressable>
      </View>
      {isBusy ? (
        <View className="bg-muted h-1.5 overflow-hidden rounded-full">
          <View className="bg-primary h-full rounded-full" style={{ width: `${progressPct}%` }} />
        </View>
      ) : null}
      <Text
        variant="small"
        className={cn(phase === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
        {message}
      </Text>
    </View>
  );
}
