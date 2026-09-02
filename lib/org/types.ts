export type MemberRole = 'owner' | 'admin' | 'member';
export type SeatStatus = 'active' | 'deactivated' | 'vacant';
export type OrgPermission = 'manage_members';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan_tier: 'individual' | 'team' | 'professional' | 'enterprise';
  seat_limit: number;
  seats_purchased: number;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'pending';
  owner_id: string;
};

export type SeatUsage = {
  used: number;
  allowance: number;
};

export type OrgMember = {
  id: string;
  user_id: string | null;
  role: MemberRole;
  seat_status: SeatStatus;
  invited_email: string | null;
  joined_at: string | null;
  permissions: Partial<Record<OrgPermission, boolean>> | null;
  email: string | null;
  seat_usage: SeatUsage | null;
};

export type OrgOverview = {
  organization: Organization;
  role: MemberRole;
  members: OrgMember[];
  usage: SeatUsage | null;
};

export type OrgErrorResponse = {
  error: string;
  message?: string;
};
