// Returns the caller's org + role + member roster for the "Team" tab. Mirrors workify-web's
// app/(dashboard)/org/page.tsx + components/dashboard/OrgOverview.tsx data needs, minus
// usage/billing charts (out of scope for mobile v1, see plan).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

  const { data: callerMembership } = await admin
    .from('workify_organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!callerMembership) {
    return jsonResponse(
      { error: 'no_organization', message: 'Choose a plan or accept an invite to get started.' },
      402
    );
  }
  const organizationId = callerMembership.organization_id as string;

  const [{ data: organization, error: orgError }, { data: members, error: membersError }] =
    await Promise.all([
      admin.from('workify_organizations').select('*').eq('id', organizationId).single(),
      admin
        .from('workify_organization_members')
        .select('id, user_id, role, seat_status, invited_email, joined_at, permissions')
        .eq('organization_id', organizationId)
        .order('joined_at', { ascending: true }),
    ]);

  if (orgError || !organization) {
    return jsonResponse({ error: 'organization_not_found' }, 404);
  }
  if (membersError) {
    return jsonResponse({ error: 'members_query_failed', message: membersError.message }, 500);
  }

  // auth.users isn't exposed via PostgREST -- resolve each member's email via the Auth Admin
  // API, same as workify-web's OrgOverview.tsx does.
  const membersWithEmail = await Promise.all(
    (members ?? []).map(async (member) => {
      let email = member.invited_email ?? null;
      if (member.user_id) {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        email = data.user?.email ?? email;
      }
      return { ...member, email };
    })
  );

  return jsonResponse({
    organization,
    role: callerMembership.role,
    members: membersWithEmail,
  });
});
