import { useCallback, useEffect, useRef, useState } from 'react';

import * as manualsClient from '@/lib/manuals/client';
import { ManualsError } from '@/lib/manuals/client';
import type { LibraryCapacity, WorkspaceDocument } from '@/lib/manuals/types';
import { useManualsUpload } from '@/lib/manuals-upload-context';

export function useManualsLibrary() {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [capacity, setCapacity] = useState<LibraryCapacity | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const upload = useManualsUpload();
  // Upload/training state and its poll loop live in ManualsUploadProvider (mounted at the app
  // root) so they survive navigating away from this screen -- see that file's comment. This hook
  // just re-fetches the document list when a poll (running independently of this screen's
  // lifetime) reaches "done", so a manual that finished training while the user was elsewhere
  // still shows up as soon as they come back.
  const previousPhaseRef = useRef(upload.uploadPhase);

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

  useEffect(() => {
    if (previousPhaseRef.current !== 'done' && upload.uploadPhase === 'done') {
      refresh();
    }
    previousPhaseRef.current = upload.uploadPhase;
  }, [upload.uploadPhase, refresh]);

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
    uploadPhase: upload.uploadPhase,
    uploadProgress: upload.uploadProgress,
    uploadMessage: upload.uploadMessage,
    uploadTarget: upload.uploadTarget,
    upload: upload.upload,
    resetUpload: upload.resetUpload,
    remove,
  };
}
