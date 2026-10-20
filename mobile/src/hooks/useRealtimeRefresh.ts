import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

let channelCounter = 0;

/**
 * Calls `onChange` whenever a row in `donations` or `claims` changes. Row level security
 * applies to realtime too, so each user is only notified about rows they may see.
 * Changes are debounced because one claim touches both tables.
 */
export function useRealtimeRefresh(onChange: () => void) {
  const callback = useRef(onChange);

  useEffect(() => {
    callback.current = onChange;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 300);
    };

    const channel = supabase
      .channel(`mealbridge-changes-${++channelCounter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, fire)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
