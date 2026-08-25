// Server-side proxy to the sys-rag backend (https://syspare-rag-py.onrender.com), mirroring
// workify-web/app/api/rag/chat/route.ts. sys-rag has no auth of its own and trusts whatever
// organization_id it's sent, so this must run server-side, not from the client -- this function
// resolves the caller's real organization_id and overwrites anything the client sent.
//
// v1 deliberately skips workify-web's seat/billing-allowance check (workify_seats lookup +
// recordAiAnswerUsage) -- the only gate here is "does this user have an org at all". If not,
// the client should call bootstrap-organization and retry.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RAG_API_URL = Deno.env.get('RAG_API_URL') ?? 'https://syspare-rag-py.onrender.com';

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

  const { data: membership } = await admin
    .from('workify_organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return jsonResponse(
      { error: 'no_organization', message: 'Choose a plan or accept an invite to get started.' },
      402
    );
  }
  const organizationId = membership.organization_id as string;

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
      if (typeof payload.answer === 'string') {
        // Fire-and-forget: a logging failure must never cost the user their answer.
        // @ts-ignore EdgeRuntime is injected by the Supabase Edge Runtime, not a Deno global type.
        EdgeRuntime.waitUntil(
          admin
            .from('rag_prompt_logs')
            .insert({
              email: user.email ?? '',
              user_id: user.id,
              session_id: sessionId,
              question: clientBody.question,
              answer: payload.answer,
              manual_id: outboundBody.manual_id,
              locale: outboundBody.answer_language ?? null,
              organization_id: organizationId,
              seat_id: null,
              credits_consumed: 0,
            })
            .then(({ error }) => {
              if (error) console.error('[rag-chat] prompt log failed:', error);
            })
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
