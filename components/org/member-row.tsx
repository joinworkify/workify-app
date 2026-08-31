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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import type { MemberRole, OrgMember } from '@/lib/org/types';
import { cn } from '@/lib/utils';

const ROLE_BADGE_VARIANT: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

type MemberRowProps = {
  member: OrgMember;
  callerRole: MemberRole;
  canAct: boolean;
  onDeactivate: (memberId: string) => Promise<void>;
  onActivate: (memberId: string) => Promise<void>;
  onSetPermissions: (memberId: string, manageMembers: boolean) => Promise<void>;
};

export function MemberRow({
  member,
  callerRole,
  canAct,
  onDeactivate,
  onActivate,
  onSetPermissions,
}: MemberRowProps) {
  const [isBusy, setIsBusy] = useState(false);
  const manageMembers = member.permissions === null || member.permissions?.manage_members !== false;

  return (
    <View className="border-border flex-row items-center justify-between gap-3 border-b px-4 py-3">
      <View className="flex-1 gap-1">
        <Text className="font-medium" numberOfLines={1}>
          {member.email ?? member.invited_email ?? 'Unknown'}
        </Text>
        <View className="flex-row gap-1.5">
          <Badge variant={ROLE_BADGE_VARIANT[member.role]}>
            <Text>{member.role}</Text>
          </Badge>
          {member.seat_status !== 'active' ? (
            <Badge variant="destructive">
              <Text>{member.seat_status}</Text>
            </Badge>
          ) : null}
        </View>
      </View>

      {canAct ? (
        <View className="flex-row items-center gap-2">
          {callerRole === 'owner' && member.role === 'admin' ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Text>Permissions</Text>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Admin permissions</DialogTitle>
                </DialogHeader>
                <View className="gap-2">
                  {[
                    { label: 'Full access', value: true },
                    { label: 'Limited (no member management)', value: false },
                  ].map((option) => (
                    <DialogTrigger key={String(option.value)} asChild>
                      <Button
                        variant={manageMembers === option.value ? 'default' : 'outline'}
                        onPress={() => onSetPermissions(member.id, option.value)}
                        className="justify-start">
                        <Text
                          className={cn(
                            manageMembers === option.value && 'text-primary-foreground'
                          )}>
                          {option.label}
                        </Text>
                      </Button>
                    </DialogTrigger>
                  ))}
                </View>
              </DialogContent>
            </Dialog>
          ) : null}

          {member.seat_status === 'active' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Text className="text-destructive">Remove</Text>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this member?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They&apos;ll lose access to this organization&apos;s chat until reactivated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <Text>Cancel</Text>
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isBusy}
                    onPress={async () => {
                      setIsBusy(true);
                      try {
                        await onDeactivate(member.id);
                      } finally {
                        setIsBusy(false);
                      }
                    }}>
                    <Text className="text-primary-foreground">Remove</Text>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onPress={async () => {
                setIsBusy(true);
                try {
                  await onActivate(member.id);
                } finally {
                  setIsBusy(false);
                }
              }}>
              <Text>Reactivate</Text>
            </Button>
          )}
        </View>
      ) : null}
    </View>
  );
}
