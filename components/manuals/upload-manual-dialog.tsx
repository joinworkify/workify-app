import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ManualsError } from '@/lib/manuals/client';
import { cn } from '@/lib/utils';
import type { UploadPhase } from '@/lib/manuals-upload-context';

type PickedFile = { uri: string; name: string; mimeType?: string | null };

type UploadManualDialogProps = {
  uploadPhase: UploadPhase;
  uploadProgress: number;
  uploadMessage: string;
  onUpload: (file: PickedFile, displayName?: string) => Promise<void>;
  onReset: () => void;
};

export function UploadManualDialog({
  uploadPhase,
  uploadProgress,
  uploadMessage,
  onUpload,
  onReset,
}: UploadManualDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [pickError, setPickError] = useState<string | null>(null);
  // getDocumentAsync throws ("Different document picking in progress") if called again before
  // the first call resolves -- a fast double-tap on the picker button hits this every time.
  const [isPicking, setIsPicking] = useState(false);

  const isBusy = uploadPhase === 'uploading' || uploadPhase === 'training';

  function closeAndReset(next: boolean) {
    setOpen(next);
    if (!next) {
      setFile(null);
      setDisplayName('');
      setPickError(null);
      if (uploadPhase === 'done' || uploadPhase === 'error') onReset();
    }
  }

  // Picking has to happen BEFORE the Dialog opens, not from a button inside it: this Dialog
  // renders through iOS's FullWindowOverlay (see components/ui/dialog.tsx), a separate UIWindow
  // at a very high level -- the native document picker sheet gets presented from the app's root
  // view controller and ends up stuck visually behind that overlay window if the Dialog is
  // already open. Same class of overlay/native-modal ordering issue as the comment in
  // components/chat/session-list-item.tsx about nesting an AlertDialog inside a Dialog.
  async function pickFileThenOpen() {
    if (isPicking) return;
    setIsPicking(true);
    setPickError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      setOpen(true);
    } finally {
      setIsPicking(false);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setPickError(null);
    try {
      await onUpload(file, displayName);
    } catch (err) {
      setPickError(err instanceof ManualsError ? err.message : 'Upload failed.');
    }
  }

  const progressPct = uploadPhase === 'uploading' ? 5 : uploadProgress;

  return (
    <>
      <Button size="sm" onPress={pickFileThenOpen} disabled={isPicking}>
        <Text className="text-primary-foreground">Upload manual</Text>
      </Button>

      <Dialog open={open} onOpenChange={closeAndReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload a manual</DialogTitle>
          </DialogHeader>

          <View className="gap-4">
            <View className="gap-2">
              <Label>PDF file</Label>
              <View className="bg-muted h-12 justify-center rounded-lg px-3">
                <Text numberOfLines={1}>{file?.name}</Text>
              </View>
            </View>

            <View className="gap-2">
              <Label nativeID="upload-manual-name">Display name (optional)</Label>
              <Input
                aria-labelledby="upload-manual-name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Defaults to the file name"
                editable={!isBusy}
                className="bg-muted h-12 rounded-lg border-0"
              />
            </View>

            {uploadPhase !== 'idle' ? (
              <View className="gap-2">
                {isBusy ? (
                  <View className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <View
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </View>
                ) : null}
                <Text
                  variant="small"
                  className={cn(
                    uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                  {uploadMessage}
                </Text>
              </View>
            ) : null}

            {pickError ? (
              <Text className="text-destructive" variant="small">
                {pickError}
              </Text>
            ) : null}
          </View>

          <DialogFooter>
            {uploadPhase === 'done' ? (
              // No re-pick button inside the dialog (see pickFileThenOpen's comment) -- closing
              // here just returns to the "Upload manual" trigger, which starts a fresh pick.
              <Button
                onPress={() => {
                  onReset();
                  setFile(null);
                  setDisplayName('');
                  setOpen(false);
                }}>
                <Text className="text-primary-foreground">Done</Text>
              </Button>
            ) : (
              <Button disabled={!file || isBusy} onPress={handleSubmit}>
                <Text className="text-primary-foreground">{isBusy ? 'Working…' : 'Upload'}</Text>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
