import type { MemberRole } from '@/lib/org/types';

// Client-side mirror of supabase/functions/_shared/org.ts's canActOnMember -- used only to decide
// which action buttons to render. The Edge Function re-checks this server-side on every mutation,
// so this copy existing purely for UI is safe to keep simple and never the actual authorization
// boundary.
export function canActOnMember(actorRole: MemberRole, targetRole: MemberRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole === 'member';
  return false;
}
