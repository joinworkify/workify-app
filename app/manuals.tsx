import { Stack } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapacityBar } from '@/components/manuals/capacity-bar';
import { ManualRow } from '@/components/manuals/manual-row';
import { TrainingProgressBanner } from '@/components/manuals/training-progress-banner';
import { UploadManualDialog } from '@/components/manuals/upload-manual-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useManualsLibrary } from '@/hooks/use-manuals-library';

export default function ManualsScreen() {
  const {
    documents,
    capacity,
    role,
    isLoading,
    error,
    refresh,
    uploadPhase,
    uploadProgress,
    uploadMessage,
    uploadTarget,
    upload,
    resetUpload,
    remove,
  } = useManualsLibrary();

  const isManager = role === 'owner' || role === 'admin';

  return (
    <>
      <Stack.Screen options={{ title: 'Manuals' }} />
      <SafeAreaView edges={['bottom']} className="bg-background flex-1">
        {isLoading && documents.length === 0 && !error ? (
          <View className="gap-3 p-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center gap-2 px-8">
            <Text variant="h4">No organization yet</Text>
            <Text variant="muted" className="text-center">
              {error}
            </Text>
          </View>
        ) : (
          <FlatList
            className="flex-1"
            data={documents}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
            ListHeaderComponent={
              <View className="w-full gap-4 p-4">
                {capacity ? <CapacityBar capacity={capacity} /> : null}
                <TrainingProgressBanner
                  phase={uploadPhase}
                  progress={uploadProgress}
                  message={uploadMessage}
                  target={uploadTarget}
                  onDismiss={resetUpload}
                />
                <View className="w-full flex-row items-center justify-between">
                  <Text variant="large">Manuals</Text>
                  <UploadManualDialog
                    uploadPhase={uploadPhase}
                    uploadProgress={uploadProgress}
                    uploadMessage={uploadMessage}
                    onUpload={upload}
                    onReset={resetUpload}
                  />
                </View>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center gap-2 px-8 py-12">
                <Text variant="h4">No manuals yet</Text>
                <Text variant="muted" className="text-center">
                  Manuals you upload will show up here and become searchable in chat.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <ManualRow document={item} canDelete={isManager} onDelete={remove} />
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}
