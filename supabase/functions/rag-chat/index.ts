// Server-side proxy to the sys-rag backend (https://syspare-rag-py.onrender.com), mirroring
// workify-web/app/api/rag/chat/route.ts. sys-rag has no auth of its own and trusts whatever
// organization_id it's sent, so this must run server-side, not from the client -- this function
// resolves the caller's real organization_id and overwrites anything the client sent.
//
// Now shares web's exact row-5 credit gate (_shared/org.ts's checkAiAnswerQuota/
// recordAiAnswerUsage, same workify_seats table + workify_increment_seat_usage RPC) instead of
// only checking "does this user have an org at all" -- previously an app user could burn
// unlimited AI answers without ever touching the seat allowance web enforces, and none of that
// usage showed up in the web dashboard's numbers.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { checkAiAnswerQuota, recordAiAnswerUsage } from '../_shared/org.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RAG_API_URL = Deno.env.get('RAG_API_URL') ?? 'https://syspare-rag-py.onrender.com';

// Mirrors workify-web/lib/rag/usage.ts -- same shape sys-rag's /api/chat returns in `usage`.
function isSuccessfulAnswer(payload: unknown): payload is { answer: string; usage?: unknown } {
  if (!payload || typeof payload !== 'object') return false;
  const answer = (payload as Record<string, unknown>).answer;
  return typeof answer === 'string' && answer.trim().length > 0;
}

function usageLogFields(usage: unknown): Record<string, unknown> {
  if (!usage || typeof usage !== 'object') return {};
  const raw = usage as Record<string, unknown>;
  if (typeof raw.model_name !== 'string') return {};
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    usage_metadata: raw,
    provider_model: raw.model_name,
    prompt_tokens: num(raw.prompt_tokens),
    output_tokens: num(raw.output_tokens),
    thinking_tokens: num(raw.thinking_tokens),
    total_tokens: num(raw.total_tokens),
    generation_calls: num(raw.generation_calls),
    retrieval_used: raw.retrieval_used === true,
    retrieval_expanded: raw.retrieval_expanded === true,
    estimated_cost_usd: num(raw.estimated_cost_usd),
  };
}

type ClientChatRequest = {
  session_id?: string | null;
  question: string;
  history: { role: 'user' | 'model'; content: string }[];
  manual_id?: string | null;
  answer_language?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const quota = await checkAiAnswerQuota(admin, user.id);
  if (!quota.allowed) {
    if (quota.reason === 'no_organization') {
      return jsonResponse(
        { error: 'no_organization', message: 'Choose a plan or accept an invite to get started.' },
        402
      );
    }
    if (quota.reason === 'org_inactive') {
      return jsonResponse(
        { error: 'organization_inactive', message: "This organization's subscription is not active." },
        402
      );
    }
    return jsonResponse(
      {
        error: 'ai_answer_limit_reached',
        message: "You've used all of your AI answers for this billing period.",
        used: quota.used,
        allowance: quota.allowance,
      },
      402
    );
  }
  const organizationId = quota.metered ? quota.organizationId : null;
  const seatId = quota.metered ? quota.seatId : null;

  let clientBody: ClientChatRequest;
  try {
    clientBody = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (typeof clientBody.question !== 'string' || !clientBody.question) {
    return jsonResponse({ error: 'question is required' }, 400);
  }

  // Discard the client's session_id/organization_id for security; the org is always the
  // server-resolved one. session_id isn't sys-rag's concept -- it's ours (rag_chat_sessions.id).
  const sessionId = typeof clientBody.session_id === 'string' ? clientBody.session_id : null;
  const outboundBody = {
    question: clientBody.question,
    history: Array.isArray(clientBody.history) ? clientBody.history : [],
    manual_id: typeof clientBody.manual_id === 'string' ? clientBody.manual_id : null,
    answer_language: clientBody.answer_language,
    organization_id: organizationId,
  };

  const upstream = await fetch(`${RAG_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outboundBody),
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return jsonResponse(
      { error: 'Upstream RAG server did not return JSON', status: upstream.status, body: text },
      upstream.status
    );
  }

  if (upstream.ok) {
    try {
      const payload = JSON.parse(text);
      if (isSuccessfulAnswer(payload)) {
        // Fire-and-forget: neither the credit-usage log nor the seat increment may cost the user
        // their answer if they fail. credits_consumed mirrors web's rule: 1 per answer for a real
        // metered seat, 0 for the fail-open/unmetered case (see _shared/org.ts's checkAiAnswerQuota).
        // @ts-ignore EdgeRuntime is injected by the Supabase Edge Runtime, not a Deno global type.
        EdgeRuntime.waitUntil(
          (async () => {
            const { error } = await admin.from('rag_prompt_logs').insert({
              email: user.email ?? '',
              user_id: user.id,
              session_id: sessionId,
              question: clientBody.question,
              answer: payload.answer,
              manual_id: outboundBody.manual_id,
              locale: outboundBody.answer_language ?? null,
              organization_id: organizationId,
              seat_id: seatId,
              credits_consumed: seatId ? 1 : 0,
              ...usageLogFields(payload.usage),
            });
            if (error) console.error('[rag-chat] prompt log failed:', error);

            if (seatId) {
              await recordAiAnswerUsage(admin, seatId);
            }
          })()
        );
      }
    } catch {
      // Unparseable success body -- nothing worth logging.
    }
  }

  return new Response(text, {
    status: upstream.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
