// Mobile-only signup step: gives a brand-new workify-app user a personal "individual" org so
// they have somewhere to hang chat/seat access off of. workify-web's own signup deliberately
// does NOT auto-create an org (see workify-web/lib/org/metering.ts) -- this function must not
// change that. It's called explicitly from app/(auth)/sign-up.tsx, never from a DB trigger, so
// web signups are untouched.
//
// Values mirror prod's real "individual" tier rows (seat_limit 1, seats_purchased 1, per
// workify-web/lib/pricing/tiers.ts's PRICING_TIERS.individual) -- same as any other
// individual-tier org, not a mobile-specific special case. This previously hardcoded
// ai_answers_allowance to 0, which meant every mobile-bootstrapped org started with zero AI
// answers -- invisible as long as rag-chat didn't enforce the allowance at all, but a hard block
// on every single mobile chat now that it does (see rag-chat/index.ts).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { INDIVIDUAL_BASE_LIBRARY_CAPACITY_PAGES, SELF_SERVE_ALLOWANCE_PER_SEAT } from '../_shared/org.ts';

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

  const { data: existingMembership } = await admin
    .from('workify_organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    return jsonResponse({ organization_id: existingMembership.organization_id });
  }

  const slugBase = (user.email ?? user.id).split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = `${slugBase}-${user.id.slice(0, 8)}`;

  const { data, error } = await admin.rpc('workify_create_organization', {
    p_name: user.email ?? 'My organization',
    p_slug: slug,
    p_plan_tier: 'individual',
    p_seat_limit: 1,
    p_seats_purchased: 1,
    p_owner_user_id: user.id,
    p_ai_answers_allowance: SELF_SERVE_ALLOWANCE_PER_SEAT.individual,
    p_base_library_capacity_pages: INDIVIDUAL_BASE_LIBRARY_CAPACITY_PAGES,
    p_additional_capacity_per_seat_pages: 0,
    p_status: 'active',
  });

  if (error || !data || data.length === 0) {
    console.error('[bootstrap-organization] create failed:', error);
    return jsonResponse({ error: 'bootstrap_failed' }, 500);
  }

  return jsonResponse({ organization_id: data[0].organization_id });
});
