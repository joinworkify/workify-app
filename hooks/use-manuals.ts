import { useCallback, useEffect, useState } from 'react';

import { fetchManuals } from '@/lib/rag/client';
import type { ManualInfo } from '@/lib/rag/types';

// Mirrors workify-web's FALLBACK_MANUALS (app/rag-chat/RagChatMaker.tsx) -- shown if the
// rag-manuals fetch fails (e.g. Render cold-start timeout, offline).
const FALLBACK_MANUALS: ManualInfo[] = [
  { manual_id: 'YM358_operation', display_name: 'YM358 Operation Manual' },
  { manual_id: 'YM358_service', display_name: 'YM358 Service Manual' },
  { manual_id: 'AW82_service', display_name: 'AW82 Service Manual' },
  { manual_id: 'YHCH_service', display_name: 'YHCH Service Manual' },
  { manual_id: 'YH_operation', display_name: 'YH Operation Manual' },
  { manual_id: 'EF514T_manual', display_name: 'EF514T Manual' },
];

export function useManuals() {
  const [manuals, setManuals] = useState<ManualInfo[]>(FALLBACK_MANUALS);
  const [defaultManualId, setDefaultManualId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Not a dependency-driven effect -- callers explicitly re-invoke this (e.g. every time the
  // manual picker dialog opens) so a manual uploaded mid-session shows up without needing an app
  // restart, since this hook otherwise only ever fetched once on mount.
  const refresh = useCallback(() => {
    let cancelled = false;
    fetchManuals()
      .then((response) => {
        if (cancelled) return;
        setManuals(response.manuals);
        setDefaultManualId(response.default_manual_id);
      })
      .catch(() => {
        // Keep whichever list (fallback or last-fetched) is already in state.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refresh(), [refresh]);

  return { manuals, defaultManualId, isLoading, refresh };
}
