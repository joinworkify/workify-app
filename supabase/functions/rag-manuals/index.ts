// Server-side proxy to sys-rag's GET /api/manuals (https://syspare-rag-py.onrender.com),
// mirroring workify-web/app/api/rag/manuals/route.ts. Same trust model as rag-chat: sys-rag has
// no auth of its own, so this resolves the caller's real organization_id server-side before
// forwarding, rather than trusting whatever the client might send.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RAG_API_URL = Deno.env.get('RAG_API_URL') ?? 'https://syspare-rag-py.onrender.com';

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

  const manualsUrl = new URL(`${RAG_API_URL}/api/manuals`);
  manualsUrl.searchParams.set('organization_id', membership.organization_id as string);

  const upstream = await fetch(manualsUrl, { headers: { 'Content-Type': 'application/json' } });
  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return jsonResponse(
      { error: 'Upstream RAG server did not return JSON', status: upstream.status, body: text },
      upstream.status
    );
  }

  return new Response(text, {
    status: upstream.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
