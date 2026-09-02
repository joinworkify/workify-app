import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { WorkspaceDocument } from '@/lib/manuals/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ManualRow({
  document,
  canDelete,
  onDelete,
}: {
  document: WorkspaceDocument;
  canDelete: boolean;
  onDelete: (documentId: string) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <View className="border-border flex-row items-center justify-between gap-3 border-b px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Text className="font-medium" numberOfLines={1}>
          {document.filename}
        </Text>
        <Text variant="muted" className="text-xs">
          {document.page_count} pages · Uploaded {formatDate(document.created_at)}
        </Text>
      </View>

      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <View accessibilityRole="button" hitSlop={8} className="p-2">
              <Icon as={Trash2} size={18} className="text-destructive" />
            </View>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this manual?</AlertDialogTitle>
              <AlertDialogDescription>
                {document.filename} will no longer be searchable in chat, and its pages will free
                up in your library capacity. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>Cancel</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onPress={async () => {
                  setIsDeleting(true);
                  try {
                    await onDelete(document.id);
                  } finally {
                    setIsDeleting(false);
                  }
                }}>
                <Text className="text-primary-foreground">Remove</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </View>
  );
}
