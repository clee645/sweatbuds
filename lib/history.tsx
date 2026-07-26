import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './auth';
import { toUserMessage } from './errors';
import { usePartnership } from './partnership';
import { supabase } from './supabase';
import type { Workout } from '@/types/db';

type HistoryContextValue = {
  workouts: Workout[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  prependWorkout: (w: Workout) => void;
  removeWorkout: (id: string) => void;
};

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

// All-time partnership workouts, ordered logged_at DESC. Separate from
// `useWorkouts()` (which caps at 50 for the home feed) so the History tab
// can paint full streak/total/calendar views without forcing every other
// screen to pull more data than it needs.
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { partnership } = usePartnership();
  const userId = user?.id ?? null;
  const partnershipId = partnership?.id ?? null;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = Boolean(userId) && !hasLoaded;

  // Reset first-load gate on user swap so loading state shows for the new user.
  useEffect(() => {
    setHasLoaded(false);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWorkouts([]);
      setError(null);
      setHasLoaded(false);
      return;
    }
    setError(null);

    // Show the user's OWN workouts across all time (their personal history
    // survives a partner leaving and re-pairing), plus the current partnership's
    // shared rows (so the partner's logs appear in this memory book). The partner
    // never sees the user's pre-pair / previous-partnership rows: those match
    // neither clause for them, and the partnership-scoped RLS (0022) blocks them.
    let query = supabase
      .from('workouts')
      .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at, logged_date, logged_tz')
      .order('logged_at', { ascending: false });
    if (partnershipId) {
      query = query.or(`user_id.eq.${userId},partnership_id.eq.${partnershipId}`);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(toUserMessage(fetchError, 'Could not load history.'));
      setHasLoaded(true);
      return;
    }
    setWorkouts((data ?? []) as Workout[]);
    setHasLoaded(true);
  }, [userId, partnershipId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Patch a single row in without a refetch — used by the local mutation
  // fan-out (lib/workoutSync.ts) and by the realtime subscription. The scope
  // guard mirrors the `.or(...)` predicate in refresh() above, so a row this
  // provider's own query wouldn't have returned never lands in the array.
  // Insert-then-sort rather than blind prepend: history spans all time and a
  // realtime row can arrive out of `logged_at` order.
  const prependWorkout = useCallback(
    (w: Workout) => {
      if (!userId) return;
      const inScope = partnershipId
        ? w.user_id === userId || w.partnership_id === partnershipId
        : w.user_id === userId;
      if (!inScope) return;
      setWorkouts((prev) => {
        if (prev.some((existing) => existing.id === w.id)) return prev;
        return [...prev, w].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
      });
    },
    [userId, partnershipId],
  );

  const removeWorkout = useCallback((id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const value = useMemo<HistoryContextValue>(
    () => ({ workouts, loading, error, refresh, prependWorkout, removeWorkout }),
    [workouts, loading, error, refresh, prependWorkout, removeWorkout],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistoryWorkouts(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryWorkouts must be used within HistoryProvider');
  return ctx;
}
