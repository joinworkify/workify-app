import { useCallback, useEffect, useRef, useState } from 'react';

import * as manualsClient from '@/lib/manuals/client';
import { ManualsError } from '@/lib/manuals/client';
import type { LibraryCapacity, WorkspaceDocument } from '@/lib/manuals/types';

export type UploadPhase = 'idle' | 'uploading' | 'training' | 'done' | 'error';

// Same 3s poll cadence as workify-web's UploadManualSheet.tsx -- training is a real background
// job on the RAG backend (progress 0-100), not instant.
const POLL_INTERVAL_MS = 3000;

export function useManualsLibrary() {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [capacity, setCapacity] = useState<LibraryCapacity | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  // Guards against a stale poll loop (e.g. from a dialog closed and reopened) still calling
  // setState after a newer upload has started.
  const uploadTokenRef = useRef(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await manualsClient.fetchManualsLibrary();
      setDocuments(data.documents);
      setCapacity(data.capacity);
      setRole(data.role);
    } catch (err) {
      setError(err instanceof ManualsError ? err.message : 'Failed to load manuals library.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetUpload = useCallback(() => {
    uploadTokenRef.current += 1;
    setUploadPhase('idle');
    setUploadProgress(0);
    setUploadMessage('');
  }, []);

  const upload = useCallback(
    async (file: { uri: string; name: string; mimeType?: string | null }, displayName?: string) => {
      const token = ++uploadTokenRef.current;
      setUploadPhase('uploading');
      setUploadProgress(0);
      setUploadMessage('Uploading and checking capacity...');

      try {
        const result = await manualsClient.uploadManual(file, displayName);
        if (token !== uploadTokenRef.current) return;

        setUploadPhase('training');
        setUploadMessage('Training started -- extracting text and images...');

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
            return;
          }
          if (token !== uploadTokenRef.current) return;

          setUploadProgress(status.progress ?? 0);
          setUploadMessage(status.message ?? '');

          if (status.status === 'done') {
            setUploadPhase('done');
            await refresh();
          } else if (status.status === 'error') {
            setUploadPhase('error');
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
    [refresh]
  );

  const remove = useCallback(
    async (documentId: string) => {
      await manualsClient.deleteManual(documentId);
      await refresh();
    },
    [refresh]
  );

  return {
    documents,
    capacity,
    role,
    isLoading,
    error,
    refresh,
    uploadPhase,
    uploadProgress,
    uploadMessage,
    upload,
    resetUpload,
    remove,
  };
}
