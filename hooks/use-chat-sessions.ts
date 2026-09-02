import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import type { ChatNode } from '@/lib/rag/types';
import { supabase } from '@/lib/supabase';

export type ChatSessionSummary = {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
};

export type ChatSession = ChatSessionSummary & {
  nodes: ChatNode[];
  manual_id: string | null;
};

// Shared list-loading logic for both the active (Chats tab) and archived (Profile ->
// Archived Chats) session lists -- same loading/refresh state shape, only the is_archived
// filter differs.
function useSessionsList(isArchived: boolean) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  // Split from isRefreshing on purpose: isLoading gates the initial full-screen skeleton (which
  // unmounts the FlatList/RefreshControl entirely), so it must never flip true again for a pull-
  // to-refresh -- that unmount/remount cycle is what read as the list "reloading twice" per pull.
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    const { data, error } = await supabase
      .from('rag_chat_sessions')
      .select('id, title, message_count, updated_at')
      .eq('is_archived', isArchived)
      .order('updated_at', { ascending: false });
    if (!error && data) setSessions(data as ChatSessionSummary[]);
  }, [user, isArchived]);

  useEffect(() => {
    setIsLoading(true);
    fetchSessions().finally(() => setIsLoading(false));
  }, [fetchSessions]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchSessions();
    setIsRefreshing(false);
  }, [fetchSessions]);

  return { sessions, isLoading, isRefreshing, refresh, fetchSessions };
}

export function useChatSessions() {
  const { user } = useAuth();
  const { sessions, isLoading, isRefreshing, refresh, fetchSessions } = useSessionsList(false);

  const createSession = useCallback(
    async (manualId?: string | null) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('rag_chat_sessions')
        .insert({ user_id: user.id, email: user.email, manual_id: manualId ?? null })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Failed to create session');
      await fetchSessions();
      return data.id as string;
    },
    [user, fetchSessions]
  );

  const archiveSession = useCallback(
    async (sessionId: string) => {
      const { error } = await supabase
        .from('rag_chat_sessions')
        .update({ is_archived: true })
        .eq('id', sessionId);
      if (error) throw error;
      await fetchSessions();
    },
    [fetchSessions]
  );

  return { sessions, isLoading, isRefreshing, refresh, createSession, archiveSession };
}

export function useArchivedSessions() {
  const { sessions, isLoading, isRefreshing, refresh, fetchSessions } = useSessionsList(true);

  const unarchiveSession = useCallback(
    async (sessionId: string) => {
      const { error } = await supabase
        .from('rag_chat_sessions')
        .update({ is_archived: false })
        .eq('id', sessionId);
      if (error) throw error;
      await fetchSessions();
    },
    [fetchSessions]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const { error } = await supabase.from('rag_chat_sessions').delete().eq('id', sessionId);
      if (error) throw error;
      await fetchSessions();
    },
    [fetchSessions]
  );

  return { sessions, isLoading, isRefreshing, refresh, unarchiveSession, deleteSession };
}

export function useChatSession(sessionId: string | undefined) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // handleSend fires two sequential appendAndPersist calls (optimistic user message, then the
  // model's answer) before React has re-rendered in between -- both would otherwise close over
  // the same stale `session` snapshot and the second write would clobber the first. A ref that's
  // updated synchronously on every write keeps each call reading the other's result.
  const sessionRef = useRef<ChatSession | null>(null);

  const applySession = useCallback((next: ChatSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('rag_chat_sessions')
      .select('id, title, message_count, updated_at, nodes, manual_id')
      .eq('id', sessionId)
      .single();
    if (!error && data) applySession(data as ChatSession);
    setIsLoading(false);
  }, [sessionId, applySession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const appendAndPersist = useCallback(
    async (...newNodes: ChatNode[]) => {
      const current = sessionRef.current;
      if (!sessionId || !current) return;
      const nodes = [...current.nodes, ...newNodes];
      const title =
        current.message_count === 0 && newNodes[0]
          ? (newNodes[0].content ?? '').slice(0, 60)
          : current.title;
      const { error } = await supabase
        .from('rag_chat_sessions')
        .update({
          nodes,
          message_count: nodes.length,
          title,
          // workify-web resumes a session from this node on load (its branching UI can leave
          // active_node_id pointing at an earlier turn) -- this app is always linear, so it's
          // always the newest node.
          active_node_id: nodes[nodes.length - 1]?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      if (error) throw error;
      applySession({ ...current, nodes, message_count: nodes.length, title });
    },
    [sessionId, applySession]
  );

  const updateManualId = useCallback(
    async (manualId: string | null) => {
      const current = sessionRef.current;
      if (!sessionId || !current) return;
      const { error } = await supabase
        .from('rag_chat_sessions')
        .update({ manual_id: manualId })
        .eq('id', sessionId);
      if (error) throw error;
      applySession({ ...current, manual_id: manualId });
    },
    [sessionId, applySession]
  );

  return { session, isLoading, refresh, appendAndPersist, updateManualId };
}
