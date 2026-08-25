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

export function useChatSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('rag_chat_sessions')
      .select('id, title, message_count, updated_at')
      .order('updated_at', { ascending: false });
    if (!error && data) setSessions(data as ChatSessionSummary[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createSession = useCallback(async () => {
    if (!user) throw new Error('Not signed in');
    const { data, error } = await supabase
      .from('rag_chat_sessions')
      .insert({ user_id: user.id, email: user.email })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Failed to create session');
    await refresh();
    return data.id as string;
  }, [user, refresh]);

  return { sessions, isLoading, refresh, createSession };
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
          ? newNodes[0].content.slice(0, 60)
          : current.title;
      const { error } = await supabase
        .from('rag_chat_sessions')
        .update({
          nodes,
          message_count: nodes.length,
          title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      if (error) throw error;
      applySession({ ...current, nodes, message_count: nodes.length, title });
    },
    [sessionId, applySession]
  );

  return { session, isLoading, refresh, appendAndPersist };
}
