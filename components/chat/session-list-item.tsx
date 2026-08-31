import { router } from 'expo-router';
import { MessageCircle, MoreVertical } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ChatSessionSummary } from '@/hooks/use-chat-sessions';
import { useNow } from '@/hooks/use-now';

function formatRelativeTime(iso: string, now: number) {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export type SessionAction = {
  label: string;
  icon: LucideIcon;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
  // Destructive actions go through an AlertDialog confirmation instead of firing immediately.
  confirmTitle?: string;
  confirmDescription?: string;
};

export function SessionListItem({
  session,
  actions,
}: {
  session: ChatSessionSummary;
  actions?: SessionAction[];
}) {
  const now = useNow();
  const [menuOpen, setMenuOpen] = useState(false);
  // Deliberately a sibling of the menu Dialog below, not nested inside it -- an AlertDialog
  // rendered inside DialogContent gets unmounted the instant the parent Dialog closes (which we
  // do immediately on every menu tap), killing the confirmation before it can show. Keeping it
  // independent lets the menu close and the confirmation open at the same time.
  const [pendingAction, setPendingAction] = useState<SessionAction | null>(null);

  return (
    <View className="border-border flex-row items-center border-b">
      <Pressable
        onPress={() => router.push({ pathname: '/(app)/chats/[id]', params: { id: session.id } })}
        className="active:bg-accent flex-1 flex-row items-center gap-3 px-4 py-3">
        <View className="bg-primary/10 size-10 items-center justify-center rounded-full">
          <Icon as={MessageCircle} className="text-primary" size={18} />
        </View>
        <View className="flex-1">
          <Text className="font-medium" numberOfLines={1}>
            {session.title}
          </Text>
          <Text variant="muted" className="text-xs">
            {session.message_count} messages · {formatRelativeTime(session.updated_at, now)}
          </Text>
        </View>
      </Pressable>

      {actions && actions.length > 0 ? (
        <>
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <Pressable accessibilityRole="button" hitSlop={8} className="px-3 py-3">
                <Icon as={MoreVertical} size={18} className="text-muted-foreground" />
              </Pressable>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle numberOfLines={1}>{session.title}</DialogTitle>
              </DialogHeader>
              <View className="gap-1">
                {actions.map((action) => (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    onPress={() => {
                      setMenuOpen(false);
                      if (action.destructive) {
                        setPendingAction(action);
                      } else {
                        action.onPress();
                      }
                    }}
                    className="active:bg-muted flex-row items-center gap-3 rounded-lg px-3 py-3">
                    <Icon
                      as={action.icon}
                      size={18}
                      className={action.destructive ? 'text-destructive' : 'text-foreground'}
                    />
                    <Text className={action.destructive ? 'text-destructive' : undefined}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={pendingAction !== null}
            onOpenChange={(open) => {
              if (!open) setPendingAction(null);
            }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingAction?.confirmTitle ?? `${pendingAction?.label}?`}
                </AlertDialogTitle>
                {pendingAction?.confirmDescription ? (
                  <AlertDialogDescription>{pendingAction.confirmDescription}</AlertDialogDescription>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Text>Cancel</Text>
                </AlertDialogCancel>
                <AlertDialogAction
                  onPress={() => {
                    pendingAction?.onPress();
                    setPendingAction(null);
                  }}>
                  <Text className="text-primary-foreground">{pendingAction?.label}</Text>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </View>
  );
}
