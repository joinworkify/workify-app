// Dispatch function for the "Team" tab's write actions -- add/deactivate/activate a member,
// change an admin's permissions. Mirrors workify-web's app/api/organizations/[id]/members/**
// routes' authorization rules exactly (see _shared/org.ts), one function instead of five to
// keep the number of Edge Function deploys down.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  activateMember,
  addMember,
  canActOnMember,
  deactivateMember,
  getMemberRole,
  getMemberRoleById,
  hasOrgPermission,
  isOrgManager,
  normalizePermissions,
  type MemberRole,
  type OrgPermission,
} from '../_shared/org.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type ManageRequest =
  | { action: 'add_member'; email: string; role?: 'member' | 'admin' }
  | { action: 'deactivate_member'; member_id: string }
  | { action: 'activate_member'; member_id: string }
  | { action: 'set_permissions'; member_id: string; permissions: Partial<Record<OrgPermission, boolean>> };

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
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!callerMembership) {
    return jsonResponse({ error: 'no_organization' }, 402);
  }
  const organizationId = callerMembership.organization_id as string;

  const callerRole = await getMemberRole(admin, organizationId, user.id);
  const isManager = await isOrgManager(admin, organizationId, user.id);
  if (!callerRole || !isManager) {
    return jsonResponse({ error: 'forbidden', message: 'Only org managers can do this.' }, 403);
  }
  // An admin (not owner) additionally needs the manage_members permission -- same gate web's
  // routes apply on top of isOrgManager.
  if (callerRole === 'admin' && !(await hasOrgPermission(admin, organizationId, user.id, 'manage_members'))) {
    return jsonResponse({ error: 'forbidden', message: "You don't have permission to manage members." }, 403);
  }

  let body: ManageRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  try {
    switch (body.action) {
      case 'add_member': {
        const email = body.email?.trim();
        if (!email) return jsonResponse({ error: 'email is required' }, 400);
        const requestedRole: MemberRole = body.role === 'admin' ? 'admin' : 'member';
        if (requestedRole === 'admin' && callerRole !== 'owner') {
          return jsonResponse(
            { error: 'forbidden', message: 'Only the org owner can grant the admin role.' },
            403
          );
        }

        const { data: newUserId } = await admin.rpc('workify_get_user_id_by_email', {
          p_email: email,
        });
        if (!newUserId) {
          return jsonResponse(
            { error: 'user_not_found', message: 'No signed-up user found with that email.' },
            404
          );
        }

        const result = await addMember(admin, organizationId, newUserId, requestedRole, {
          allowElevatedRole: callerRole === 'owner',
        });
        if (!result) {
          return jsonResponse(
            { error: 'no_seats_available', message: 'No seats left on this plan.' },
            409
          );
        }
        return jsonResponse({ member_id: result.memberId });
      }

      case 'deactivate_member': {
        if (!body.member_id) return jsonResponse({ error: 'member_id is required' }, 400);
        const targetRole = await getMemberRoleById(admin, body.member_id);
        if (!targetRole) return jsonResponse({ error: 'member_not_found' }, 404);
        if (!canActOnMember(callerRole, targetRole)) {
          return jsonResponse({ error: 'forbidden' }, 403);
        }
        await deactivateMember(admin, body.member_id);
        return jsonResponse({ ok: true });
      }

      case 'activate_member': {
        if (!body.member_id) return jsonResponse({ error: 'member_id is required' }, 400);
        const targetRole = await getMemberRoleById(admin, body.member_id);
        if (!targetRole) return jsonResponse({ error: 'member_not_found' }, 404);
        if (!canActOnMember(callerRole, targetRole)) {
          return jsonResponse({ error: 'forbidden' }, 403);
        }
        const result = await activateMember(admin, organizationId, body.member_id);
        if (!result) {
          return jsonResponse(
            { error: 'no_seats_available', message: 'No seats left on this plan.' },
            409
          );
        }
        return jsonResponse({ ok: true });
      }

      case 'set_permissions': {
        if (callerRole !== 'owner') {
          return jsonResponse(
            { error: 'forbidden', message: 'Only the org owner can change admin permissions.' },
            403
          );
        }
        if (!body.member_id) return jsonResponse({ error: 'member_id is required' }, 400);
        const targetRole = await getMemberRoleById(admin, body.member_id);
        if (targetRole !== 'admin') {
          return jsonResponse(
            { error: 'invalid_target', message: 'Permissions only apply to admins.' },
            400
          );
        }
        const permissions = normalizePermissions(body.permissions ?? {});
        const { error } = await admin
          .from('workify_organization_members')
          .update({ permissions })
          .eq('id', body.member_id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: 'unknown_action' }, 400);
    }
  } catch (err) {
    return jsonResponse(
      { error: 'request_failed', message: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
