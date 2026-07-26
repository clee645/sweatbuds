import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useWorkoutSync } from '@/lib/workoutSync';
import type { Workout } from '@/types/db';

// Live workout propagation while the app is open. Mounted once at the root,
// inside both WorkoutsProvider and HistoryProvider (see app/_layout.tsx).
//
// Without this, a partner's new log waits on the `partner_logged` push or the
// next app foreground, and a partner's DELETE waits on nothing at all — there
// is no delete trigger, so the card lingered until a refetch.
//
// No `filter:` on either listener, mirroring the workout_comments channel in
// lib/comments.tsx: RLS (migration 0022) decides which rows reach us, and each
// provider's own scope guard decides which array they belong in. Requires
// public.workouts to be in the supabase_realtime publication and to have
// `replica identity full` — both in migration 0025.
export function WorkoutsRealtime() {
  const { user } = useAuth();
  const { addWorkoutLocal, removeWorkoutLocal } = useWorkoutSync();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`workouts:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workouts' },
        (payload) => {
          const row = payload.new as Workout | null;
          if (!row?.id) return;
          // Self-echo is harmless: our own insert already ran through
          // addWorkoutLocal optimistically and both providers dedupe by id,
          // so totalCount isn't double-counted.
          addWorkoutLocal(row);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'workouts' },
        (payload) => {
          const row = payload.old as Partial<Workout> | null;
          if (!row?.id) return;
          // Idempotent — no-ops if we never held the row.
          removeWorkoutLocal(row.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, addWorkoutLocal, removeWorkoutLocal]);

  return null;
}
