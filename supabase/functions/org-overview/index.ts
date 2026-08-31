// Returns the caller's org + role + member roster for the "Team" tab, plus each active member's
// current-period AI-answer usage (workify_seats.ai_answers_used/allowance) so mobile shows the
// same seat metering numbers as workify-web's dashboard -- no billing/purchase UI, just usage.
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

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: organization, error: orgError },
    { data: members, error: membersError },
    { data: seats, error: seatsError },
  ] = await Promise.all([
    admin.from('workify_organizations').select('*').eq('id', organizationId).single(),
    admin
      .from('workify_organization_members')
      .select('id, user_id, role, seat_status, invited_email, joined_at, permissions')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true }),
    // Only the seat(s) covering today -- a member can have past-period seat rows too, but those
    // aren't "current usage".
    admin
      .from('workify_seats')
      .select('current_member_id, ai_answers_used, ai_answers_allowance')
      .eq('organization_id', organizationId)
      .lte('billing_period_start', today)
      .gte('billing_period_end', today)
      .not('current_member_id', 'is', null),
  ]);

  if (orgError || !organization) {
    return jsonResponse({ error: 'organization_not_found' }, 404);
  }
  if (membersError) {
    return jsonResponse({ error: 'members_query_failed', message: membersError.message }, 500);
  }
  if (seatsError) {
    return jsonResponse({ error: 'seats_query_failed', message: seatsError.message }, 500);
  }

  const usageByMemberId = new Map(
    (seats ?? []).map((seat) => [
      seat.current_member_id as string,
      { used: seat.ai_answers_used as number, allowance: seat.ai_answers_allowance as number },
    ])
  );
  const usage = (seats ?? []).reduce(
    (total, seat) => ({
      used: total.used + (seat.ai_answers_used as number),
      allowance: total.allowance + (seat.ai_answers_allowance as number),
    }),
    { used: 0, allowance: 0 }
  );

  // auth.users isn't exposed via PostgREST -- resolve each member's email via the Auth Admin
  // API, same as workify-web's OrgOverview.tsx does.
  const membersWithEmail = await Promise.all(
    (members ?? []).map(async (member) => {
      let email = member.invited_email ?? null;
      if (member.user_id) {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        email = data.user?.email ?? email;
      }
      return { ...member, email, seat_usage: usageByMemberId.get(member.id) ?? null };
    })
  );

  return jsonResponse({
    organization,
    role: callerMembership.role,
    members: membersWithEmail,
    usage: (seats ?? []).length > 0 ? usage : null,
  });
});
