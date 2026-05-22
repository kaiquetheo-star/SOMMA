import { useEffect } from 'react';

import { getSupabase } from '@/lib/supabase/client';
import { useSommaStore } from '@/store/useSommaStore';

/**
 * Optional Supabase Realtime subscription for `user_stats`.
 * Updates local Zustand when essence scores change server-side.
 * Fails silently if Realtime is unavailable (offline / not enabled).
 */
export function useUserStatsRealtime(userId: string | undefined): void {
  const setUserStats = useSommaStore((s) => s.setUserStats);

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`user_stats:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setUserStats({
            body_essence: Number(row.body_essence ?? 0),
            mind_essence: Number(row.mind_essence ?? 0),
            spirit_essence: Number(row.spirit_essence ?? 0),
            combat_mastery: Number(row.combat_mastery ?? 0),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, setUserStats]);
}
