import { useCallback } from 'react';

import { useHistoryWorkouts } from './history';
import { useWorkouts } from './workouts';
import type { Workout } from '@/types/db';

type WorkoutSync = {
  addWorkoutLocal: (w: Workout) => void;
  removeWorkoutLocal: (id: string) => void;
};

// Workouts live in two independently-scoped providers: `useWorkouts()` (the
// 50-row partnership-scoped home window) and `useHistoryWorkouts()` (all-time,
// own-or-partnership). Every mutation has to reach both, or one screen keeps a
// row the other just dropped — that drift is exactly how a deleted workout used
// to leave a dangling card on the home carousel.
//
// Both underlying operations are idempotent and scope-guarded: prepend dedupes
// by id and ignores out-of-scope rows, remove no-ops on an id it doesn't hold.
// So calling this for a row that only belongs in one provider is safe, which is
// what lets the realtime subscription fan out blindly.
//
// Must be called below HistoryProvider (see app/_layout.tsx).
export function useWorkoutSync(): WorkoutSync {
  const { prependWorkout: addHome, removeWorkout: removeHome } = useWorkouts();
  const { prependWorkout: addHistory, removeWorkout: removeHistory } =
    useHistoryWorkouts();

  const addWorkoutLocal = useCallback(
    (w: Workout) => {
      addHome(w);
      addHistory(w);
    },
    [addHome, addHistory],
  );

  const removeWorkoutLocal = useCallback(
    (id: string) => {
      removeHome(id);
      removeHistory(id);
    },
    [removeHome, removeHistory],
  );

  return { addWorkoutLocal, removeWorkoutLocal };
}
