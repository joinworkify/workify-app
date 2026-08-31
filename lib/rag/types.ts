// Mirrors supabase/functions/rag-chat's request/response shapes, which in turn mirror
// sys-rag's own Pydantic models (rag_server.py). Role values are 'user' | 'model' -- Gemini's
// convention, not 'assistant'. Get this wrong and message rendering silently breaks.
export type ChatRole = 'user' | 'model';

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

export type RagChatResponse = {
  session_id: string;
  log_id?: string | null;
  answer: string;
  history: ChatHistoryEntry[];
  texts: unknown[];
  images: ImageMatch[];
  manual_id?: string | null;
  retrieval_expanded: boolean;
  usage?: Record<string, unknown> | null;
};

export type RagChatErrorResponse = {
  error: string;
  message?: string;
};

// One turn as stored in rag_chat_sessions.nodes (jsonb array).
export type ChatNode = {
  id: string;
  role: ChatRole;
  content: string;
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
