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
import { uploadWorkoutImage } from './storage';
import { supabase } from './supabase';
import type { Workout } from '@/types/db';

const BUCKET = 'workout-images';

type CreateWorkoutInput = {
  userId: string;
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
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  prependWorkout: (w: Workout) => void;
  removeWorkout: (id: string) => void;
};

const WorkoutsContext = createContext<WorkoutsContextValue | undefined>(undefined);

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWorkouts([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('workouts')
      .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at')
      .order('logged_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      setWorkouts([]);
      setLoading(false);
      setError(fetchError.message);
      return;
    }
    setWorkouts((data ?? []) as Workout[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const prependWorkout = useCallback((w: Workout) => {
    setWorkouts((prev) => {
      if (prev.some((existing) => existing.id === w.id)) return prev;
      return [w, ...prev];
    });
  }, []);

  const removeWorkout = useCallback((id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const value = useMemo<WorkoutsContextValue>(
    () => ({ workouts, loading, error, refresh, prependWorkout, removeWorkout }),
    [workouts, loading, error, refresh, prependWorkout, removeWorkout],
  );

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>;
}

export function useWorkouts(): WorkoutsContextValue {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) throw new Error('useWorkouts must be used within WorkoutsProvider');
  return ctx;
}
