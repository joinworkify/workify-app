import { useCallback, useEffect, useState } from 'react';

import * as orgClient from '@/lib/org/client';
import type { OrgOverview } from '@/lib/org/types';

export function useOrganization() {
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orgClient.fetchOrgOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof orgClient.OrgError ? err.message : 'Failed to load organization.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Simplest correct approach: refetch the whole roster after any mutation rather than
  // optimistically patching local state -- these actions are infrequent and the server is the
  // source of truth for seat/permission side effects anyway.
  async function withRefresh<T>(action: () => Promise<T>): Promise<T> {
    const result = await action();
    await refresh();
    return result;
  }

  return {
    overview,
    isLoading,
    error,
    refresh,
    addMember: (email: string, role?: 'member' | 'admin') =>
      withRefresh(() => orgClient.addMember(email, role)),
    deactivateMember: (memberId: string) => withRefresh(() => orgClient.deactivateMember(memberId)),
    activateMember: (memberId: string) => withRefresh(() => orgClient.activateMember(memberId)),
    setPermissions: (memberId: string, permissions: Parameters<typeof orgClient.setPermissions>[1]) =>
      withRefresh(() => orgClient.setPermissions(memberId, permissions)),
  };
}
