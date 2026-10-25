import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

type Table = 'donations' | 'claims' | 'profiles';

let channelCounter = 0;
const DEFAULT_TABLES: readonly Table[] = ['donations', 'claims'];

/**
 * Calls `onChange` whenever a row in one of `tables` changes (default: donations and claims).
 * Row level security applies to realtime too, so each user is only notified about rows they
 * may see. Changes are debounced because one claim touches several tables.
 */
export function useRealtimeRefresh(
  onChange: () => void,
  tables: readonly Table[] = DEFAULT_TABLES,
) {
  const callback = useRef(onChange);
  // A string key keeps the effect stable even when callers pass a new array each render.
  const tablesKey = tables.join(',');

  useEffect(() => {
    callback.current = onChange;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 300);
    };

    let channel = supabase.channel(`mealbridge-changes-${++channelCounter}`);
    for (const table of tablesKey.split(',') as Table[]) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tablesKey]);
}
