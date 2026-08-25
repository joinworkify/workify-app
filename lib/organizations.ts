import { supabase } from '@/lib/supabase';

type BootstrapOrganizationResult = { organization_id: string };

/**
 * Ensures the current user has an organization to hang chat access off of.
 * Idempotent server-side (see supabase/functions/bootstrap-organization) —
 * safe to call on every sign-up/sign-in without checking membership first.
 * Deliberately mobile-only: workify-web's own signup never auto-creates an
 * org, and this must not change that behavior.
 */
export async function bootstrapOrganization() {
  const { data, error } = await supabase.functions.invoke<BootstrapOrganizationResult>(
    'bootstrap-organization'
  );
  return { organizationId: data?.organization_id ?? null, error };
}
