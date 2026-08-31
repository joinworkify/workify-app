import { useEffect, useState } from 'react';

// Ticks a shared "now" so relative-time labels (e.g. session-list-item's "3m ago") update live
// while the screen is open instead of freezing at whatever Date.now() the initial render saw.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
