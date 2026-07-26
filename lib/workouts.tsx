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
import { toUserMessage } from './errors';
import { usePartnership } from './partnership';
import { deleteWorkoutImages, uploadWorkoutImage } from './storage';
import { supabase } from './supabase';
import { deviceTimezone } from './zonedTime';
import type { Workout } from '@/types/db';

type CreateWorkoutInput = {
  userId: string;
  partnershipId?: string | null;
  selfieUri: string;
  environmentUri: string;
  caption: string | null;
  // Stable across retries of the same capture session. When the caller supplies
  // it, a retry re-puts the same two storage paths (uploadWorkoutImage upserts)
  // instead of minting a fresh id and orphaning the previous attempt's objects.
  workoutId?: string;
};

// Uploads two images then inserts the row. That's inherently non-atomic, so
// every failure path below compensates by removing whatever already landed —
// otherwise a failed log leaves unreferenced objects in the bucket that only
// account deletion would ever reclaim.
export async function createWorkout(input: CreateWorkoutInput): Promise<Workout> {
  const workoutId = input.workoutId ?? randomUUID();

  // allSettled, not all: with Promise.all a rejection from one upload discards
  // the other's resolved path, leaving it orphaned and unrecoverable.
  const results = await Promise.allSettled([
    uploadWorkoutImage(input.selfieUri, input.userId, workoutId, 'selfie'),
    uploadWorkoutImage(input.environmentUri, input.userId, workoutId, 'environment'),
  ]);

  const uploaded = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => r.value);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');

  if (failed) {
    await deleteWorkoutImages(uploaded);
    throw failed.reason instanceof Error
      ? failed.reason
      : new Error('Failed to upload workout photos');
  }

  const [selfiePath, environmentPath] = uploaded;
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
      // The device's zone RIGHT NOW, not the stored profile value — a workout
      // logged while travelling belongs to the day where it happened. A trigger
      // turns this into logged_date server-side, so the client never gets to
      // choose the date itself.
      logged_tz: deviceTimezone(),
    })
    .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at, logged_date, logged_tz')
    .single();

  if (error || !data) {
    // Both objects are already in the bucket at this point.
    await deleteWorkoutImages([selfiePath, environmentPath]);
    throw error ?? new Error('Failed to insert workout');
  }
  return data as Workout;
}

export async function deleteWorkout(workout: Workout): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', workout.id);
  if (error) throw error;

  const paths = [workout.selfie_path, workout.environment_path].filter(
    (p): p is string => Boolean(p),
  );
  await deleteWorkoutImages(paths);
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
      .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at, logged_date, logged_tz')
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
      // Stored for display, so it has to be user-facing copy rather than the
      // raw transport string.
      setError(toUserMessage(rowsResult.error, 'Could not load workouts.'));
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

  // The scope guard mirrors the partnership/user filter in refresh() above, so
  // a row this provider's own query wouldn't have returned never lands in the
  // array (or in totalCount). Deps are the two string keys rather than the
  // partnership object so the identity stays stable across re-renders — the
  // realtime subscription keys its effect off this callback.
  const prependWorkout = useCallback(
    (w: Workout) => {
      if (!userId) return;
      const inScope = partnershipKey
        ? w.partnership_id === partnershipKey
        : w.user_id === userId;
      if (!inScope) return;
      let added = false;
      setWorkouts((prev) => {
        if (prev.some((existing) => existing.id === w.id)) return prev;
        added = true;
        // Sort rather than blind-prepend: a realtime row from the partner can
        // arrive out of `logged_at` order relative to what's already loaded.
        return [w, ...prev].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
      });
      if (added) setTotalCount((prev) => (prev === null ? prev : prev + 1));
    },
    [userId, partnershipKey],
  );

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
