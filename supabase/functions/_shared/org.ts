// Ported near-verbatim from workify-web/lib/org/members.ts + permissions.ts -- same tables, same
// RPCs (workify_replace_seat_member, workify_activate_seat_member, workify_get_user_id_by_email),
// same authorization rules, so mobile's "Team" tab behaves identically to the web /org page.
// Billing/seat-purchase UI is deliberately not built on mobile (see plan), but findOrCreateAvailableSeat
// is still needed here: adding/reactivating a member can still claim or provision a seat the org
// already has room for under its existing seats_purchased limit -- that's provisioning, not purchasing.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type MemberRole = 'owner' | 'admin' | 'member';
export type OrgPermission = 'manage_members';

const ALL_PERMISSIONS: OrgPermission[] = ['manage_members'];

// Mirrors workify-web/lib/pricing/tiers.ts's self-serve tiers -- only the one field
// findOrCreateAvailableSeat needs (aiAnswersAllowancePerSeat). Enterprise orgs aren't self-serve
// (hand-configured), so they fall through to the "mirror an existing seat" branch below, same as
// web.
const SELF_SERVE_ALLOWANCE_PER_SEAT: Record<string, number> = {
  individual: 600,
  team: 1600,
  professional: 4050,
};

export async function isOrgManager(
  admin: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await admin
    .from('workify_organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();

  return data?.role === 'owner' || data?.role === 'admin';
}

export function canActOnMember(actorRole: MemberRole, targetRole: MemberRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole === 'member';
  return false;
}

export async function hasOrgPermission(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  permission: OrgPermission
): Promise<boolean> {
  const { data } = await admin
    .from('workify_organization_members')
    .select('role, permissions')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();

  if (!data) return false;
  if (data.role === 'owner') return true;
  if (data.role !== 'admin') return false;

  const permissions = data.permissions as Partial<Record<OrgPermission, boolean>> | null;
  if (permissions === null) return true;
  return permissions[permission] === true;
}

export async function getMemberRole(
  admin: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<MemberRole | null> {
  const { data } = await admin
    .from('workify_organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('seat_status', 'active')
    .maybeSingle();
  return (data?.role as MemberRole | undefined) ?? null;
}

export async function getMemberRoleById(
  admin: SupabaseClient,
  memberId: string
): Promise<MemberRole | null> {
  const { data } = await admin
    .from('workify_organization_members')
    .select('role')
    .eq('id', memberId)
    .maybeSingle();
  return (data?.role as MemberRole | undefined) ?? null;
}

export function normalizePermissions(
  next: Partial<Record<OrgPermission, boolean>>
): Partial<Record<OrgPermission, boolean>> | null {
  const allGranted = ALL_PERMISSIONS.every((key) => next[key] !== false);
  return allGranted ? null : next;
}

async function getReferenceSeatBillingPeriod(
  admin: SupabaseClient,
  organizationId: string
): Promise<{ start: string; end: string } | null> {
  const { data: referenceSeat } = await admin
    .from('workify_seats')
    .select('billing_period_start, billing_period_end')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!referenceSeat) return null;
  return { start: referenceSeat.billing_period_start, end: referenceSeat.billing_period_end };
}

// Finds a vacant seat within the org's current billing period, or creates a new one if the org
// hasn't hit seats_purchased yet. Returns null if neither is available -- callers decide how to
// surface "no seats left" (mobile just shows the error, no purchase flow).
async function findOrCreateAvailableSeat(
  admin: SupabaseClient,
  organizationId: string
): Promise<{ seatId: string } | null> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: vacantSeat } = await admin
    .from('workify_seats')
    .select('id')
    .eq('organization_id', organizationId)
    .is('current_member_id', null)
    .lte('billing_period_start', today)
    .gte('billing_period_end', today)
    .limit(1)
    .maybeSingle();

  if (vacantSeat) return { seatId: vacantSeat.id };

  const { data: org } = await admin
    .from('workify_organizations')
    .select('seats_purchased, plan_tier')
    .eq('id', organizationId)
    .single();

  if (!org) return null;

  const { count: seatCount } = await admin
    .from('workify_seats')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .lte('billing_period_start', today)
    .gte('billing_period_end', today);

  if ((seatCount ?? 0) >= org.seats_purchased) {
    return null; // no seats available
  }

  const period = await getReferenceSeatBillingPeriod(admin, organizationId);

  let allowance = SELF_SERVE_ALLOWANCE_PER_SEAT[org.plan_tier] ?? 0;
  if (!(org.plan_tier in SELF_SERVE_ALLOWANCE_PER_SEAT)) {
    const { data: fullReferenceSeat } = await admin
      .from('workify_seats')
      .select('ai_answers_allowance')
      .eq('organization_id', organizationId)
      .eq('credit_fraction', 1.0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    allowance = fullReferenceSeat?.ai_answers_allowance ?? 0;
  }

  const { data: seat, error: seatError } = await admin
    .from('workify_seats')
    .insert({
      organization_id: organizationId,
      current_member_id: null,
      billing_period_start: period?.start ?? today,
      billing_period_end:
        period?.end ??
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0))
          .toISOString()
          .slice(0, 10),
      ai_answers_allowance: allowance,
      ai_answers_used: 0,
      credit_fraction: 1.0,
    })
    .select('id')
    .single();

  if (seatError || !seat) throw seatError ?? new Error('seat insert returned no row');
  return { seatId: seat.id };
}

export async function addMember(
  admin: SupabaseClient,
  organizationId: string,
  newUserId: string,
  role: MemberRole = 'member',
  options: { allowElevatedRole?: boolean } = {}
): Promise<{ memberId: string; seatId: string } | null> {
  if (role === 'owner') {
    throw new Error('addMember cannot grant role owner -- use replaceMember to transfer ownership');
  }
  if (role === 'admin' && !options.allowElevatedRole) {
    throw new Error('Only the org owner (or a platform admin) can grant the admin role');
  }

  const available = await findOrCreateAvailableSeat(admin, organizationId);
  if (!available) return null;

  const { data, error } = await admin
    .rpc('workify_replace_seat_member', {
      p_seat_id: available.seatId,
      p_new_user_id: newUserId,
      p_new_role: role,
    })
    .single();

  if (error || !data) throw error ?? new Error('workify_replace_seat_member returned no row');
  return { memberId: (data as { new_member_id: string }).new_member_id, seatId: available.seatId };
}

export async function activateMember(
  admin: SupabaseClient,
  organizationId: string,
  memberId: string
): Promise<{ seatId: string } | null> {
  const { data: member, error: memberError } = await admin
    .from('workify_organization_members')
    .select('id, seat_status')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (memberError) throw memberError;
  if (!member) throw new Error('Member not found in this organization');
  if (member.seat_status !== 'deactivated') {
    throw new Error(`Member is not deactivated (current status: ${member.seat_status})`);
  }

  const available = await findOrCreateAvailableSeat(admin, organizationId);
  if (!available) return null;

  const { error } = await admin.rpc('workify_activate_seat_member', {
    p_seat_id: available.seatId,
    p_member_id: memberId,
  });

  if (error) throw error;
  return { seatId: available.seatId };
}

export async function deactivateMember(admin: SupabaseClient, memberId: string): Promise<void> {
  const { error: memberError } = await admin
    .from('workify_organization_members')
    .update({ seat_status: 'deactivated', deactivated_at: new Date().toISOString() })
    .eq('id', memberId);

  if (memberError) throw memberError;

  const { error: seatError } = await admin
    .from('workify_seats')
    .update({ current_member_id: null })
    .eq('current_member_id', memberId);

  if (seatError) throw seatError;
}
