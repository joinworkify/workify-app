import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ManualsError } from '@/lib/manuals/client';
import { cn } from '@/lib/utils';
import type { UploadPhase } from '@/hooks/use-manuals-library';

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

  async function pickFile() {
    setPickError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
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
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Text className="text-primary-foreground">Upload manual</Text>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a manual</DialogTitle>
        </DialogHeader>

        <View className="gap-4">
          <View className="gap-2">
            <Label>PDF file</Label>
            <Button variant="outline" onPress={pickFile} disabled={isBusy} className="justify-start">
              <Text numberOfLines={1}>{file ? file.name : 'Choose a PDF...'}</Text>
            </Button>
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
                className={cn(uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
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
            <Button
              onPress={() => {
                onReset();
                setFile(null);
                setDisplayName('');
              }}>
              <Text className="text-primary-foreground">Upload another</Text>
            </Button>
          ) : (
            <Button disabled={!file || isBusy} onPress={handleSubmit}>
              <Text className="text-primary-foreground">{isBusy ? 'Working…' : 'Upload'}</Text>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
