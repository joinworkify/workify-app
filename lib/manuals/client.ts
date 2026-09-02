import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type {
  ManualsLibraryErrorResponse,
  ManualsLibraryResponse,
  TrainingStatusResponse,
  UploadManualResponse,
} from '@/lib/manuals/types';

export class ManualsError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

// Same unwrap pattern as lib/rag/client.ts and lib/org/client.ts.
async function unwrapFunctionError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as ManualsLibraryErrorResponse;
      throw new ManualsError(body.error ?? 'request_failed', body.message);
    } catch (parseError) {
      if (parseError instanceof ManualsError) throw parseError;
    }
  }
  throw new ManualsError('request_failed', error instanceof Error ? error.message : undefined);
}

export async function fetchManualsLibrary(): Promise<ManualsLibraryResponse> {
  const { data, error } = await supabase.functions.invoke<
    ManualsLibraryResponse | ManualsLibraryErrorResponse
  >('manuals-library', { body: { action: 'list' } });

  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) throw new ManualsError(data.error, data.message);
  return data as ManualsLibraryResponse;
}

// `file` is a { uri, name, mimeType } object from expo-document-picker -- appended to FormData
// as a React Native file part (RN's fetch polyfill knows to stream the uri's contents), not a
// real Blob/File like the browser has.
export async function uploadManual(
  file: { uri: string; name: string; mimeType?: string | null },
  displayName?: string
): Promise<UploadManualResponse> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/pdf',
  } as unknown as Blob);
  if (displayName?.trim()) formData.append('displayName', displayName.trim());

  const { data, error } = await supabase.functions.invoke<
    UploadManualResponse | ManualsLibraryErrorResponse
  >('manuals-library', { body: formData });

  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) throw new ManualsError(data.error, data.message);
  return data as UploadManualResponse;
}

export async function fetchTrainingStatus(params: {
  jobId: string;
  manualId: string;
  displayName: string;
  pageCount: number;
}): Promise<TrainingStatusResponse> {
  const { data, error } = await supabase.functions.invoke<
    TrainingStatusResponse | ManualsLibraryErrorResponse
  >('manuals-library', {
    body: {
      action: 'status',
      jobId: params.jobId,
      manualId: params.manualId,
      displayName: params.displayName,
      pageCount: params.pageCount,
    },
  });

  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) throw new ManualsError(data.error, data.message);
  return data as TrainingStatusResponse;
}

export async function deleteManual(documentId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<
    { ok: true } | ManualsLibraryErrorResponse
  >('manuals-library', { body: { action: 'delete', document_id: documentId } });

  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) throw new ManualsError(data.error, data.message);
}
