// Mirrors supabase/functions/manuals-library's response shapes, which in turn mirror
// workify-web's workify_workspace_documents row shape (lib/org/documents.ts's WorkspaceDocument)
// and getOrgLibraryCapacity's return shape (lib/org/usage.ts). This is the org's own uploaded
// library (what counts against capacity) -- distinct from lib/rag/types.ts's ManualInfo, which is
// every manual (global + org-private) a user can *query* in chat.
export type WorkspaceDocument = {
  id: string;
  manual_id: string | null;
  filename: string;
  page_count: number;
  created_at: string;
};

export type LibraryCapacity = {
  usedPages: number;
  limitPages: number;
};

export type ManualsLibraryResponse = {
  documents: WorkspaceDocument[];
  capacity: LibraryCapacity;
  role: 'owner' | 'admin' | 'member';
};

export type UploadManualResponse = {
  ok: true;
  manualId: string;
  displayName: string;
  pageCount: number;
  jobId: string;
};

// Mirrors sys-rag's real _run_training_job status values (rag_server.py) -- "running" while in
// progress (never "pending"/"processing"), then terminal "done" or "error". Confirmed against a
// real local run, not just web's client-side comment about it.
export type TrainingStatus = 'running' | 'done' | 'error';

export type TrainingStatusResponse = {
  status: TrainingStatus;
  progress: number;
  message: string;
};

export type ManualsLibraryErrorResponse = {
  error: string;
  message?: string;
  usedPages?: number;
  limitPages?: number;
  pageCount?: number;
};
