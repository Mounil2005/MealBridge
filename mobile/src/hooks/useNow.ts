import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs`, so time-dependent UI stays correct while open. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
