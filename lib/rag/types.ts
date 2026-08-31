// Mirrors supabase/functions/rag-chat's request/response shapes, which in turn mirror
// sys-rag's own Pydantic models (rag_server.py). Role values are 'user' | 'model' -- Gemini's
// convention, not 'assistant'. This is only the wire format for the `history` sent to sys-rag,
// not the role stored on a ChatNode -- see ChatNodeRole below.
export type ChatRole = 'user' | 'model';

// rag_chat_sessions.nodes is shared with workify-web (same table, same rows) -- its ChatNode
// uses 'user' | 'assistant' (app/rag-chat/RagChatMaker.tsx), not Gemini's 'user'/'model'. Nodes
// stored with the wrong role, or missing parentId/result, render as an empty bubble on web or
// crash it outright (RagChatResultView dereferences `result` unconditionally).
export type ChatNodeRole = 'user' | 'assistant';

export type ChatHistoryEntry = {
  role: ChatRole;
  content: string;
};

export type SendRagChatInput = {
  session_id?: string | null;
  question: string;
  history: ChatHistoryEntry[];
  manual_id?: string | null;
  answer_language?: string;
};

// Mirrors sys-rag's ImageMatch Pydantic model (rag_server.py) -- img_url is a real (usually S3)
// URL, not a path that needs a base prepended, unlike workify-web's assetBaseUrl handling for
// its older non-S3 deployments.
export type ImageMatch = {
  img_url: string;
  caption: string;
  score?: number | null;
  page?: number | null;
  doc?: string | null;
};

// Mirrors sys-rag's TextChunk Pydantic model (rag_server.py) -- a retrieved manual passage
// backing the answer, shown in web's "Retrieved Text Chunks" panel (RagChatResultView.tsx).
export type TextChunk = {
  chunk_text: string;
  score?: number | null;
  page?: number | null;
  doc?: string | null;
};

export type RagChatResponse = {
  session_id: string;
  log_id?: string | null;
  answer: string;
  history: ChatHistoryEntry[];
  texts: TextChunk[];
  images: ImageMatch[];
  manual_id?: string | null;
  retrieval_expanded: boolean;
  usage?: Record<string, unknown> | null;
};

export type RagChatErrorResponse = {
  error: string;
  message?: string;
  used?: number;
  allowance?: number;
};

// One turn as stored in rag_chat_sessions.nodes (jsonb array) -- shape matches workify-web's
// ChatNode so either app can render a session the other created. `content`/`images` are the
// legacy flat shape this app wrote before nodes were made cross-compatible; still read as a
// fallback for old rows, never written for new ones.
export type ChatNode = {
  id: string;
  parentId: string | null;
  role: ChatNodeRole;
  content?: string;
  question?: string;
  result?: RagChatResponse;
  createdAt: string;
  images?: ImageMatch[];
};

// Mirrors sys-rag's ManualInfo/ManualListResponse Pydantic models (rag_server.py).
export type ManualInfo = {
  manual_id: string;
  display_name: string;
  description?: string;
  is_default?: boolean;
  has_cache?: boolean;
  pdf_count?: number;
};

export type ManualListResponse = {
  default_manual_id: string;
  manuals: ManualInfo[];
};
