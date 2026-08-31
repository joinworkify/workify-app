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
export const SELF_SERVE_ALLOWANCE_PER_SEAT: Record<string, number> = {
  individual: 600,
  team: 1600,
  professional: 4050,
};

// Mirrors workify-web/lib/pricing/tiers.ts's PRICING_TIERS.individual.baseLibraryCapacityPages --
// bootstrap-organization needs this alongside the allowance above so a mobile-created org's page
// capacity isn't silently zeroed out the same way its AI-answer allowance was (see that file).
export const INDIVIDUAL_BASE_LIBRARY_CAPACITY_PAGES = 5000;

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

// --- Row-5 AI-answer credit metering -----------------------------------------------------
// Ported near-verbatim from workify-web/lib/org/metering.ts + organizations.ts's
// isOrgAccessBlocked. This is the piece mobile's rag-chat function was missing entirely: it used
// to only check "does a membership row exist" and then call ../syspare-rag-py directly, so every
// mobile AI answer skipped the seat allowance check AND never incremented ai_answers_used --
// invisible to the web dashboard's usage numbers and unenforced. Keeping the exact same table
// shapes/RPCs as web means a seat's usage is one shared counter regardless of which app burned it.

const BLOCKED_ORG_STATUSES: readonly string[] = ['canceled', 'past_due', 'pending'];

export async function isOrgAccessBlocked(
  admin: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('workify_organizations')
    .select('status')
    .eq('id', organizationId)
    .maybeSingle();

  return !!data?.status && BLOCKED_ORG_STATUSES.includes(data.status);
}

export type QuotaCheck =
  | { allowed: true; metered: true; organizationId: string; seatId: string }
  | { allowed: true; metered: false; organizationId: null; seatId: null }
  | { allowed: false; reason: 'no_organization' }
  | { allowed: false; reason: 'org_inactive'; organizationId: string }
  | {
      allowed: false;
      reason: 'quota_exceeded';
      organizationId: string;
      seatId: string;
      used: number;
      allowance: number;
    };

// Call BEFORE forwarding a chat/query request to the RAG backend.
export async function checkAiAnswerQuota(admin: SupabaseClient, userId: string): Promise<QuotaCheck> {
  const { data: membership } = await admin
    .from('workify_organization_members')
    .select('id, organization_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return { allowed: false, reason: 'no_organization' };
  }

  if (await isOrgAccessBlocked(admin, membership.organization_id)) {
    return { allowed: false, reason: 'org_inactive', organizationId: membership.organization_id };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: seat } = await admin
    .from('workify_seats')
    .select('id, ai_answers_used, ai_answers_allowance')
    .eq('current_member_id', membership.id)
    .lte('billing_period_start', today)
    .gte('billing_period_end', today)
    .order('billing_period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!seat) {
    console.warn(
      `[metering] no active-period seat for member ${membership.id} (org ${membership.organization_id}) -- failing open (unmetered)`
    );
    return { allowed: true, metered: false, organizationId: null, seatId: null };
  }

  if (seat.ai_answers_used >= seat.ai_answers_allowance) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      organizationId: membership.organization_id,
      seatId: seat.id,
      used: seat.ai_answers_used,
      allowance: seat.ai_answers_allowance,
    };
  }

  return { allowed: true, metered: true, organizationId: membership.organization_id, seatId: seat.id };
}

// Call AFTER a successful AI answer to atomically increment usage (same workify_increment_seat_usage
// RPC web uses, so concurrent requests from either app can't undercount). Deliberately does not
// send the 80%/100% threshold email web's recordAiAnswerUsage sends (lib/org/notifications.ts is
// Next.js/email-client specific) -- and deliberately does NOT flip the notified_* flags either, so
// whichever app's request actually crosses a threshold still lets web send that email later rather
// than silently marking it "already notified."
export async function recordAiAnswerUsage(admin: SupabaseClient, seatId: string): Promise<void> {
  const { error } = await admin.rpc('workify_increment_seat_usage', { p_seat_id: seatId }).single();
  if (error) {
    console.error('[metering] failed to increment seat usage', error);
  }
}
