import { remainingMs } from '@couchwave/shared';
import { useEffect, useState } from 'react';

/** Milliseconds left until `endsAt` (server time), re-rendering every 100ms. */
export function useCountdown(endsAt: number | null, serverTime: number, receivedAt: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  return endsAt === null ? 0 : remainingMs(endsAt, serverTime, receivedAt, now);
}
