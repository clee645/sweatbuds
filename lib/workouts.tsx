import { randomUUID } from 'expo-crypto';
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
import { usePartnership } from './partnership';
import { uploadWorkoutImage } from './storage';
import { supabase } from './supabase';
import type { Workout } from '@/types/db';

const BUCKET = 'workout-images';

type CreateWorkoutInput = {
  userId: string;
  partnershipId?: string | null;
  selfieUri: string;
  environmentUri: string;
  caption: string | null;
};

export async function createWorkout(input: CreateWorkoutInput): Promise<Workout> {
  const workoutId = randomUUID();

  const [selfiePath, environmentPath] = await Promise.all([
    uploadWorkoutImage(input.selfieUri, input.userId, workoutId, 'selfie'),
    uploadWorkoutImage(input.environmentUri, input.userId, workoutId, 'environment'),
  ]);

  const trimmed = input.caption?.trim();
  const caption = trimmed && trimmed.length > 0 ? trimmed.slice(0, 140) : null;

  const { data, error } = await supabase
    .from('workouts')
    .insert({
      id: workoutId,
      user_id: input.userId,
      partnership_id: input.partnershipId ?? null,
      selfie_path: selfiePath,
      environment_path: environmentPath,
      caption,
    })
    .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at')
    .single();

  if (error || !data) throw error ?? new Error('Failed to insert workout');
  return data as Workout;
}

export async function deleteWorkout(workout: Workout): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', workout.id);
  if (error) throw error;

  const paths = [workout.selfie_path, workout.environment_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
}

type WorkoutsContextValue = {
  workouts: Workout[];
  // All-time partnership-scoped workout count. Independent of the 50-row
  // `workouts` window — kept fresh via a HEAD count query and adjusted on
  // local insert/delete. `null` only while the very first fetch is in flight.
  totalCount: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  prependWorkout: (w: Workout) => void;
  removeWorkout: (id: string) => void;
};

const WorkoutsContext = createContext<WorkoutsContextValue | undefined>(undefined);

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { partnership } = usePartnership();
  const userId = user?.id ?? null;
  // Re-fetch when the partnership identity changes — pairing flips RLS
  // visibility, so rows from the new partner suddenly become readable.
  const partnershipKey = partnership?.id ?? null;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  // Stale-while-revalidate: `loading` is only true on the very first fetch
  // for a given user. Subsequent refreshes (foreground, push, partnership
  // change) update the array silently while the previous data stays on
  // screen — no skeleton flash on app re-open.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = Boolean(userId) && !hasLoaded;

  // Reset the first-load gate when the user changes (sign out / sign in).
  useEffect(() => {
    setHasLoaded(false);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWorkouts([]);
      setTotalCount(null);
      setError(null);
      setHasLoaded(false);
      return;
    }
    setError(null);

    // Scope by partnership_id so the home feed and totalCount only ever
    // surface the current partnership's photos. RLS would otherwise allow
    // own-rows-from-any-time through, leaking pre-pair or previous-
    // partnership workouts to a new partner.
    let rowsQuery = supabase
      .from('workouts')
      .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at')
      .order('logged_at', { ascending: false })
      .limit(50);
    let countQuery = supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true });
    if (partnershipKey) {
      rowsQuery = rowsQuery.eq('partnership_id', partnershipKey);
      countQuery = countQuery.eq('partnership_id', partnershipKey);
    } else {
      // Solo user — show their own workouts, never anybody else's.
      rowsQuery = rowsQuery.eq('user_id', userId);
      countQuery = countQuery.eq('user_id', userId);
    }
    const [rowsResult, countResult] = await Promise.all([rowsQuery, countQuery]);

    if (rowsResult.error) {
      setError(rowsResult.error.message);
      setHasLoaded(true);
      return;
    }
    setWorkouts((rowsResult.data ?? []) as Workout[]);
    if (!countResult.error && typeof countResult.count === 'number') {
      setTotalCount(countResult.count);
    }
    setHasLoaded(true);
  }, [userId, partnershipKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const prependWorkout = useCallback((w: Workout) => {
    let added = false;
    setWorkouts((prev) => {
      if (prev.some((existing) => existing.id === w.id)) return prev;
      added = true;
      return [w, ...prev];
    });
    if (added) setTotalCount((prev) => (prev === null ? prev : prev + 1));
  }, []);

  const removeWorkout = useCallback((id: string) => {
    let removed = false;
    setWorkouts((prev) => {
      const next = prev.filter((w) => w.id !== id);
      if (next.length !== prev.length) removed = true;
      return next;
    });
    if (removed) setTotalCount((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
  }, []);

  const value = useMemo<WorkoutsContextValue>(
    () => ({ workouts, totalCount, loading, error, refresh, prependWorkout, removeWorkout }),
    [workouts, totalCount, loading, error, refresh, prependWorkout, removeWorkout],
  );

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>;
}

export function useWorkouts(): WorkoutsContextValue {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) throw new Error('useWorkouts must be used within WorkoutsProvider');
  return ctx;
}
