import type { Partnership, PartnershipAnchorHistory, Workout } from '@/types/db';

import {
  getPairedAnchor,
  getPartnershipWeekBoundaries,
} from './week';

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// In Mon-Sun buckets: 0 = Mon, 6 = Sun.
// In partnership-anchored buckets: 0 = first day of bucket (matches
// weekStart.getDay()), 1..dayCount-1 = subsequent days.

export type WeekBucket = {
  weekStart: Date; // 00:00 local
  weekEnd: Date; // 00:00 local of the day after the last day (exclusive)
  // 7 for normal weeks. 8-13 for the extended transition bucket that absorbs
  // the leftover days when the user changes their week start day.
  dayCount: number;
  isTransition: boolean;
  workouts: Workout[];
  // Index i = bucket.weekStart + i days. Length === dayCount.
  byDay: Workout[][];
};

const MS_PER_DAY = 86_400_000;

// 00:00 local-time of the Monday on or before `d`.
export function getMondayWeekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // JS getDay(): Sun=0..Sat=6. We want Mon=0..Sun=6.
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

// Day index relative to Mon-anchored week. 0 = Mon, 6 = Sun.
export function getMondayDayIndex(d: Date): DayIndex {
  return ((d.getDay() + 6) % 7) as DayIndex;
}

// "YYYY-MM-DD" using the device's local date, suitable as a stable key for
// grouping workouts by the day they were posted.
export function isoLocalDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Group workouts into the partnership's era-aware week boundaries. Within
// each closed era we stride 7 days from its anchor; when the next 7-day
// stride would overrun the era's end, the LAST bucket is extended to absorb
// the leftover days — that's the "transition week" the user lived through
// when changing their start day. The open era's final bucket is the current
// in-progress week from `getWeekWindow`, which may itself be extended via a
// pending pre-promotion change. Pre-pair workouts are dropped. Returns
// newest week first.
export function bucketWorkoutsByPartnershipWeek(
  workouts: Workout[],
  partnership: Partnership | null | undefined,
  anchorHistory: PartnershipAnchorHistory[] | null | undefined,
  now: Date = new Date(),
): WeekBucket[] {
  const pair = getPairedAnchor(partnership);
  if (!pair) return [];
  const boundaries = getPartnershipWeekBoundaries(partnership, anchorHistory, now);
  if (boundaries.length === 0) return [];
  const pairMs = pair.getTime();

  const buckets: WeekBucket[] = boundaries.map((b) => ({
    weekStart: b.weekStart,
    weekEnd: b.weekEnd,
    dayCount: b.dayCount,
    isTransition: b.isTransition,
    workouts: [],
    byDay: Array.from({ length: b.dayCount }, () => [] as Workout[]),
  }));

  for (const w of workouts) {
    const ts = new Date(w.logged_at);
    if (Number.isNaN(ts.getTime())) continue;
    const tsDay = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
    const tsDayMs = tsDay.getTime();
    if (tsDayMs < pairMs) continue;

    // Binary search for the bucket containing this day.
    let lo = 0;
    let hi = buckets.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = buckets[mid];
      if (tsDayMs < b.weekStart.getTime()) hi = mid - 1;
      else if (tsDayMs >= b.weekEnd.getTime()) lo = mid + 1;
      else {
        found = mid;
        break;
      }
    }
    if (found < 0) continue;
    const bucket = buckets[found];
    bucket.workouts.push(w);
    const dayIdx = Math.floor(
      (tsDayMs - bucket.weekStart.getTime()) / MS_PER_DAY,
    );
    if (dayIdx >= 0 && dayIdx < bucket.dayCount) {
      bucket.byDay[dayIdx].push(w);
    }
  }

  return buckets.slice().reverse();
}

// Group workouts by Mon-Sun week, newest week first. Workouts within a
// bucket retain the input order (callers usually pass DESC-by-logged_at).
export function bucketWorkoutsByMonSunWeek(workouts: Workout[]): WeekBucket[] {
  const map = new Map<number, WeekBucket>();
  for (const w of workouts) {
    const ts = new Date(w.logged_at);
    if (Number.isNaN(ts.getTime())) continue;
    const start = getMondayWeekStart(ts);
    const key = start.getTime();
    let bucket = map.get(key);
    if (!bucket) {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      bucket = {
        weekStart: start,
        weekEnd: end,
        dayCount: 7,
        isTransition: false,
        workouts: [],
        byDay: Array.from({ length: 7 }, () => [] as Workout[]),
      };
      map.set(key, bucket);
    }
    bucket.workouts.push(w);
    bucket.byDay[getMondayDayIndex(ts)].push(w);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );
}

// Group workouts by ISO local-date (YYYY-MM-DD). Within each day, workouts
// are sorted ASC by logged_at so callers can pick `[0]` as "earliest of day".
export function bucketWorkoutsByDay(workouts: Workout[]): Record<string, Workout[]> {
  const out: Record<string, Workout[]> = {};
  for (const w of workouts) {
    const ts = new Date(w.logged_at);
    if (Number.isNaN(ts.getTime())) continue;
    const key = isoLocalDate(ts);
    (out[key] ??= []).push(w);
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => +new Date(a.logged_at) - +new Date(b.logged_at));
  }
  return out;
}

// True iff both partners individually logged ≥ `target` distinct workout
// days within the supplied week's workout list. Counts distinct calendar
// days (ISO local date) so the math is correct for transition buckets that
// span more than 7 days.
export function partnershipWeekGoalHit(
  weekWorkouts: Workout[],
  aId: string | null | undefined,
  bId: string | null | undefined,
  target: number,
): boolean {
  if (!aId || !bId || target <= 0) return false;
  const aDays = new Set<string>();
  const bDays = new Set<string>();
  for (const w of weekWorkouts) {
    const key = isoLocalDate(w.logged_at);
    if (w.user_id === aId) aDays.add(key);
    else if (w.user_id === bId) bDays.add(key);
  }
  return aDays.size >= target && bDays.size >= target;
}

// Distinct workout days per user for a given week's workout list. Keyed by
// ISO local date so the count is correct regardless of bucket length.
export function distinctDaysPerUser(
  weekWorkouts: Workout[],
  aId: string | null | undefined,
  bId: string | null | undefined,
): { a: number; b: number } {
  const aDays = new Set<string>();
  const bDays = new Set<string>();
  for (const w of weekWorkouts) {
    const key = isoLocalDate(w.logged_at);
    if (aId && w.user_id === aId) aDays.add(key);
    else if (bId && w.user_id === bId) bDays.add(key);
  }
  return { a: aDays.size, b: bDays.size };
}

// Counts consecutive completed past Mon-Sun weeks (couple both hit target).
// The current in-progress week is skipped unless it is already complete.
// Preserved for callers that still bucket by Mon-Sun; the home + history
// surfaces now use `partnershipWeekStreak` from `./week.ts` which walks the
// partnership-anchored grid instead.
export function partnershipStreak(
  buckets: WeekBucket[],
  aId: string | null | undefined,
  bId: string | null | undefined,
  target: number,
  now = new Date(),
): number {
  if (!aId || !bId || target <= 0) return 0;
  const currentStart = getMondayWeekStart(now).getTime();

  // Build a map keyed by week start ms for O(1) walk-back.
  const byStart = new Map<number, WeekBucket>();
  for (const b of buckets) byStart.set(b.weekStart.getTime(), b);

  let cursor = currentStart;
  const currentBucket = byStart.get(cursor);
  const currentHit = currentBucket
    ? partnershipWeekGoalHit(currentBucket.workouts, aId, bId, target)
    : false;
  // If current week isn't complete, start counting from last week.
  if (!currentHit) {
    cursor -= 7 * MS_PER_DAY;
  }

  let streak = 0;
  while (true) {
    const bucket = byStart.get(cursor);
    if (!bucket) break;
    if (!partnershipWeekGoalHit(bucket.workouts, aId, bId, target)) break;
    streak += 1;
    cursor -= 7 * MS_PER_DAY;
  }
  return streak;
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// "Nov 13 - Nov 19" given Mon weekStart and exclusive next-Mon weekEnd.
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const lastDay = new Date(weekEnd);
  lastDay.setDate(lastDay.getDate() - 1);
  const a = `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
  const b = `${MONTHS_SHORT[lastDay.getMonth()]} ${lastDay.getDate()}`;
  return `${a} - ${b}`;
}
