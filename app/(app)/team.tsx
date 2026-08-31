import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddMemberDialog } from '@/components/org/add-member-dialog';
import { MemberRow } from '@/components/org/member-row';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useOrganization } from '@/hooks/use-organization';
import { canActOnMember } from '@/lib/org/permissions';

export default function TeamScreen() {
  const {
    overview,
    isLoading,
    error,
    refresh,
    addMember,
    deactivateMember,
    activateMember,
    setPermissions,
  } = useOrganization();

  if (isLoading && !overview) {
    return (
      <SafeAreaView className="bg-background flex-1">
        <View className="gap-3 p-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !overview) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center gap-2 px-8">
        <Text variant="h4">No organization yet</Text>
        <Text variant="muted" className="text-center">
          {error ?? 'Try signing out and back in.'}
        </Text>
      </SafeAreaView>
    );
  }

  const { organization, role, members } = overview;
  const isManager = role === 'owner' || role === 'admin';

  return (
    <SafeAreaView className="bg-background flex-1">
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="gap-3 p-4">
            <View className="gap-1">
              <Text variant="h3">{organization.name}</Text>
              <View className="flex-row items-center gap-2">
                <Badge variant="secondary">
                  <Text>{organization.plan_tier}</Text>
                </Badge>
                <Text variant="muted">
                  {members.filter((m) => m.seat_status === 'active').length}/
                  {organization.seat_limit} seats
                </Text>
              </View>
            </View>
            {isManager ? (
              <View className="items-start">
                <AddMemberDialog isOwner={role === 'owner'} onAdd={addMember} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            callerRole={role}
            canAct={isManager && item.role !== 'owner' && canActOnMember(role, item.role)}
            onDeactivate={deactivateMember}
            onActivate={activateMember}
            onSetPermissions={(memberId, manageMembers) =>
              setPermissions(memberId, { manage_members: manageMembers })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
