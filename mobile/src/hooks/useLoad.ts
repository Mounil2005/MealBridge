import { useCallback, useEffect, useRef, useState } from 'react';

interface LoadState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Re-runs the loader without showing the loading state (pull-to-refresh, realtime updates). */
  reload: () => Promise<void>;
}

interface Snapshot<T> {
  key: string;
  data: T | undefined;
  error: string | null;
}

/**
 * Runs `loader` on mount and whenever `key` changes. Pass a key that identifies the inputs
 * the loader depends on (an id, a flag). Out-of-order responses are discarded, so a slow
 * earlier request can never overwrite a newer one.
 */
export function useLoad<T>(loader: () => Promise<T>, key: string): LoadState<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>();
  const loaderRef = useRef(loader);
  const requestId = useRef(0);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const data = await loaderRef.current();
      if (id === requestId.current) setSnapshot({ key, data, error: null });
    } catch (e) {
      if (id !== requestId.current) return;
      const message = e instanceof Error ? e.message : 'Something went wrong';
      setSnapshot((prev) => ({ key, data: prev?.key === key ? prev.data : undefined, error: message }));
    }
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  const current = snapshot?.key === key ? snapshot : undefined;
  return { data: current?.data, error: current?.error ?? null, loading: !current, reload };
}
