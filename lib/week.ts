import type { Profile, WeekProgress, WeekdayKey, Workout } from '@/types/db';

const JS_DAY_TO_KEY: Record<number, WeekdayKey> = {
  0: 'S2',
  1: 'M',
  2: 'T2',
  3: 'W',
  4: 'T1',
  5: 'F',
  6: 'S1',
};

export function getWeekdayKeyFromDate(date: Date): WeekdayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

// Returns 00:00 of the most recent Wednesday (or today if today is Wednesday).
export function getCurrentWeekStart(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // JS day 3 = Wednesday. Walk back to most recent Wed.
  const offset = (d.getDay() - 3 + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

export function weekProgressFromWorkouts(
  workouts: Workout[],
  user: Profile,
  target = 3,
): WeekProgress {
  const weekStart = getCurrentWeekStart();
  const weekStartMs = weekStart.getTime();
  const completedSet = new Set<WeekdayKey>();

  for (const w of workouts) {
    if (w.user_id !== user.id) continue;
    const t = new Date(w.logged_at).getTime();
    if (Number.isNaN(t) || t < weekStartMs) continue;
    completedSet.add(getWeekdayKeyFromDate(new Date(w.logged_at)));
  }

  return {
    user,
    workoutsThisWeek: completedSet.size,
    target,
    completedDays: Array.from(completedSet),
  };
}
