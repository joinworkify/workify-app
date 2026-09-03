import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

import * as manualsClient from '@/lib/manuals/client';
import { ManualsError } from '@/lib/manuals/client';
import { notifyManualTrainingFinished } from '@/lib/notifications';

export type UploadPhase = 'idle' | 'uploading' | 'training' | 'done' | 'error';

// Same 3s poll cadence as workify-web's UploadManualSheet.tsx -- training is a real background
// job on the RAG backend (progress 0-100), not instant.
const POLL_INTERVAL_MS = 3000;

type ManualsUploadState = {
  uploadPhase: UploadPhase;
  uploadProgress: number;
  uploadMessage: string;
  uploadTarget: string | null;
  upload: (
    file: { uri: string; name: string; mimeType?: string | null },
    displayName?: string
  ) => Promise<void>;
  resetUpload: () => void;
};

const ManualsUploadContext = createContext<ManualsUploadState | null>(null);

// Mounted once at the app root (app/_layout.tsx), not inside the Manuals screen -- an upload's
// poll loop must keep running (and the eventual `workify_workspace_documents` insert must still
// happen) even if the user navigates away from the Manuals screen entirely while training is in
// progress. When that state lived inside useManualsLibrary (screen-local), leaving the screen
// unmounted it, silently killing the poll loop mid-training and losing the row insert along with
// the visible progress.
export function ManualsUploadProvider({ children }: { children: ReactNode }) {
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  // Guards against a stale poll loop (e.g. from an upload superseded by a new one) still calling
  // setState after a newer upload has started.
  const uploadTokenRef = useRef(0);

  const resetUpload = useCallback(() => {
    uploadTokenRef.current += 1;
    setUploadPhase('idle');
    setUploadProgress(0);
    setUploadMessage('');
    setUploadTarget(null);
  }, []);

  const upload = useCallback(
    async (file: { uri: string; name: string; mimeType?: string | null }, displayName?: string) => {
      const token = ++uploadTokenRef.current;
      setUploadPhase('uploading');
      setUploadProgress(0);
      setUploadMessage('Uploading and checking capacity...');
      setUploadTarget(displayName?.trim() || file.name.replace(/\.pdf$/i, ''));

      try {
        const result = await manualsClient.uploadManual(file, displayName);
        if (token !== uploadTokenRef.current) return;

        setUploadPhase('training');
        setUploadMessage('Training started -- extracting text and images...');
        setUploadTarget(result.displayName);

        const poll = async () => {
          if (token !== uploadTokenRef.current) return;
          let status;
          try {
            status = await manualsClient.fetchTrainingStatus({
              jobId: result.jobId,
              manualId: result.manualId,
              displayName: result.displayName,
              pageCount: result.pageCount,
            });
          } catch (err) {
            if (token !== uploadTokenRef.current) return;
            setUploadPhase('error');
            setUploadMessage(err instanceof ManualsError ? err.message : 'Failed to check training status.');
            notifyManualTrainingFinished(result.displayName, false);
            return;
          }
          if (token !== uploadTokenRef.current) return;

          setUploadProgress(status.progress ?? 0);
          setUploadMessage(status.message ?? '');

          if (status.status === 'done') {
            setUploadPhase('done');
            notifyManualTrainingFinished(result.displayName, true);
          } else if (status.status === 'error') {
            setUploadPhase('error');
            notifyManualTrainingFinished(result.displayName, false);
          } else {
            setTimeout(poll, POLL_INTERVAL_MS);
          }
        };

        poll();
      } catch (err) {
        if (token !== uploadTokenRef.current) return;
        setUploadPhase('error');
        setUploadMessage(err instanceof ManualsError ? err.message : 'Upload failed.');
      }
    },
    []
  );

  return (
    <ManualsUploadContext.Provider
      value={{ uploadPhase, uploadProgress, uploadMessage, uploadTarget, upload, resetUpload }}>
      {children}
    </ManualsUploadContext.Provider>
  );
}

export function useManualsUpload(): ManualsUploadState {
  const context = useContext(ManualsUploadContext);
  if (!context) {
    throw new Error('useManualsUpload must be used within a ManualsUploadProvider');
  }
  return context;
}
