import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type {
  ManualListResponse,
  RagChatErrorResponse,
  RagChatResponse,
  SendRagChatInput,
} from '@/lib/rag/types';

export class RagChatError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

// FunctionsHttpError's `context` is the raw Response for a non-2xx status -- our functions
// always return a JSON body ({ error, message? }) on failure, so parse it for the real cause.
async function unwrapFunctionError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as RagChatErrorResponse;
      throw new RagChatError(body.error ?? 'request_failed', body.message);
    } catch (parseError) {
      if (parseError instanceof RagChatError) throw parseError;
    }
  }
  throw new RagChatError('request_failed', error instanceof Error ? error.message : undefined);
}

export async function fetchManuals(): Promise<ManualListResponse> {
  const { data, error } = await supabase.functions.invoke<
    ManualListResponse | RagChatErrorResponse
  >('rag-manuals');

  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) {
    throw new RagChatError(data.error, data.message);
  }
  return data as ManualListResponse;
}

export async function sendRagChatMessage(input: SendRagChatInput): Promise<RagChatResponse> {
  const { data, error } = await supabase.functions.invoke<
    RagChatResponse | RagChatErrorResponse
  >('rag-chat', { body: input });

  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) {
    throw new RagChatError(data.error, data.message);
  }
  return data as RagChatResponse;
}
