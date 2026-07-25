import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './auth';
import { useWorkouts } from './workouts';
import { supabase } from './supabase';
import type { WorkoutComment } from '@/types/db';

const SELECT_COLUMNS = 'id, workout_id, user_id, content, created_at';

type AddArgs = { workoutId: string; content: string };

type WorkoutCommentsContextValue = {
  byWorkout: Record<string, WorkoutComment[]>;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (args: AddArgs) => Promise<void>;
  remove: (commentId: string) => Promise<void>;
};

const WorkoutCommentsContext = createContext<WorkoutCommentsContextValue | undefined>(
  undefined,
);

function groupByWorkout(rows: WorkoutComment[]): Record<string, WorkoutComment[]> {
  const out: Record<string, WorkoutComment[]> = {};
  for (const row of rows) {
    (out[row.workout_id] ??= []).push(row);
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return out;
}

export function WorkoutCommentsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { workouts } = useWorkouts();
  const userId = user?.id ?? null;

  const [byWorkout, setByWorkout] = useState<Record<string, WorkoutComment[]>>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const loading = Boolean(userId) && !hasLoaded;

  // Track which workout ids we've already fetched so we only re-fetch when the
  // visible set actually changes (not on every workouts array identity churn).
  const fetchedKeyRef = useRef<string>('');

  // Stable, sorted key for the current workout id set — used to detect changes.
  const workoutsKey = useMemo(() => {
    return workouts
      .map((w) => w.id)
      .sort()
      .join(',');
  }, [workouts]);

  useEffect(() => {
    if (!userId) {
      setHasLoaded(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setByWorkout({});
      fetchedKeyRef.current = '';
      setHasLoaded(false);
      return;
    }
    if (workouts.length === 0) {
      setByWorkout({});
      fetchedKeyRef.current = workoutsKey;
      setHasLoaded(true);
      return;
    }
    const ids = workouts.map((w) => w.id);
    const { data, error } = await supabase
      .from('workout_comments')
      .select(SELECT_COLUMNS)
      .in('workout_id', ids)
      .order('created_at', { ascending: true });
    if (error) {
      // Silent: comments are non-critical. Mark loaded so the UI doesn't hang.
      setHasLoaded(true);
      return;
    }
    setByWorkout(groupByWorkout((data ?? []) as WorkoutComment[]));
    fetchedKeyRef.current = workoutsKey;
    setHasLoaded(true);
  }, [userId, workouts, workoutsKey]);

  useEffect(() => {
    if (!userId) return;
    if (fetchedKeyRef.current === workoutsKey) return;
    void refresh();
  }, [userId, workoutsKey, refresh]);

  // Realtime: listen for INSERTs on workout_comments. RLS already restricts
  // which rows we receive — no client-side filter needed.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`workout-comments:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'workout_comments' },
        (payload) => {
          const row = payload.new as WorkoutComment | null;
          if (!row) return;
          setByWorkout((prev) => {
            const list = prev[row.workout_id] ?? [];
            if (list.some((c) => c.id === row.id)) return prev;
            return {
              ...prev,
              [row.workout_id]: [...list, row].sort((a, b) =>
                a.created_at.localeCompare(b.created_at),
              ),
            };
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'workout_comments' },
        (payload) => {
          const row = payload.old as Partial<WorkoutComment> | null;
          if (!row?.id || !row?.workout_id) return;
          setByWorkout((prev) => {
            const list = prev[row.workout_id!];
            if (!list) return prev;
            const next = list.filter((c) => c.id !== row.id);
            if (next.length === list.length) return prev;
            return { ...prev, [row.workout_id!]: next };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const add = useCallback(
    async ({ workoutId, content }: AddArgs) => {
      if (!userId) throw new Error('Not signed in');
      const trimmed = content.trim();
      if (!trimmed) return;
      const tempId = `tmp-${Date.now()}`;
      const optimistic: WorkoutComment = {
        id: tempId,
        workout_id: workoutId,
        user_id: userId,
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setByWorkout((prev) => ({
        ...prev,
        [workoutId]: [...(prev[workoutId] ?? []), optimistic],
      }));

      const { data, error } = await supabase
        .from('workout_comments')
        .insert({ workout_id: workoutId, user_id: userId, content: trimmed })
        .select(SELECT_COLUMNS)
        .single();

      if (error || !data) {
        // Roll back optimistic insert.
        setByWorkout((prev) => ({
          ...prev,
          [workoutId]: (prev[workoutId] ?? []).filter((c) => c.id !== tempId),
        }));
        // Supabase PostgrestError isn't `instanceof Error` — wrap it so the
        // caller's `err.message` access surfaces the underlying reason.
        if (error) {
          const detail = [error.message, error.details, error.hint]
            .filter(Boolean)
            .join(' — ');
          const wrapped = new Error(detail || 'Failed to post comment');
          (wrapped as Error & { code?: string }).code = error.code;
          throw wrapped;
        }
        throw new Error('Failed to post comment');
      }

      const saved = data as WorkoutComment;
      setByWorkout((prev) => {
        const list = prev[workoutId] ?? [];
        const replaced = list.some((c) => c.id === tempId)
          ? list.map((c) => (c.id === tempId ? saved : c))
          : list.some((c) => c.id === saved.id)
            ? list
            : [...list, saved];
        return {
          ...prev,
          [workoutId]: replaced.sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          ),
        };
      });
    },
    [userId],
  );

  const remove = useCallback(async (commentId: string) => {
    const { error } = await supabase
      .from('workout_comments')
      .delete()
      .eq('id', commentId);
    if (error) throw error;
    setByWorkout((prev) => {
      const out: Record<string, WorkoutComment[]> = {};
      for (const [wid, list] of Object.entries(prev)) {
        out[wid] = list.filter((c) => c.id !== commentId);
      }
      return out;
    });
  }, []);

  const value = useMemo<WorkoutCommentsContextValue>(
    () => ({ byWorkout, loading, refresh, add, remove }),
    [byWorkout, loading, refresh, add, remove],
  );

  return (
    <WorkoutCommentsContext.Provider value={value}>
      {children}
    </WorkoutCommentsContext.Provider>
  );
}

export function useWorkoutComments(): WorkoutCommentsContextValue {
  const ctx = useContext(WorkoutCommentsContext);
  if (!ctx) {
    throw new Error('useWorkoutComments must be used within WorkoutCommentsProvider');
  }
  return ctx;
}
