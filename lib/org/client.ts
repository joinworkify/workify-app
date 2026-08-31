import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { OrgErrorResponse, OrgOverview, OrgPermission } from '@/lib/org/types';

export class OrgError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

// Same unwrap pattern as lib/rag/client.ts -- our functions always return a JSON body
// ({ error, message? }) on failure, so parse it for the real cause.
async function unwrapFunctionError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as OrgErrorResponse;
      throw new OrgError(body.error ?? 'request_failed', body.message);
    } catch (parseError) {
      if (parseError instanceof OrgError) throw parseError;
    }
  }
  throw new OrgError('request_failed', error instanceof Error ? error.message : undefined);
}

export async function fetchOrgOverview(): Promise<OrgOverview> {
  const { data, error } = await supabase.functions.invoke<OrgOverview | OrgErrorResponse>(
    'org-overview'
  );
  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) throw new OrgError(data.error, data.message);
  return data as OrgOverview;
}

async function invokeManage(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean } | OrgErrorResponse>(
    'org-manage',
    { body }
  );
  if (error) return unwrapFunctionError(error);
  if (data && 'error' in data) throw new OrgError(data.error, data.message);
}

export function addMember(email: string, role: 'member' | 'admin' = 'member') {
  return invokeManage({ action: 'add_member', email, role });
}

export function deactivateMember(memberId: string) {
  return invokeManage({ action: 'deactivate_member', member_id: memberId });
}

export function activateMember(memberId: string) {
  return invokeManage({ action: 'activate_member', member_id: memberId });
}

export function setPermissions(memberId: string, permissions: Partial<Record<OrgPermission, boolean>>) {
  return invokeManage({ action: 'set_permissions', member_id: memberId, permissions });
}
