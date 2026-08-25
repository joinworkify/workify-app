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

export type RagChatResponse = {
  session_id: string;
  log_id?: string | null;
  answer: string;
  history: ChatHistoryEntry[];
  texts: unknown[];
  images: unknown[];
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
};
