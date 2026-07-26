import { getPairedAnchorYmd, getPartnershipWeekBoundaries, workoutYmd } from './week';
import { addZonedDays, diffZonedDays, zonedMonthDay } from './zonedTime';
import type { Partnership, PartnershipAnchorHistory, Workout } from '@/types/db';

// Re-exported so consumers can keep importing it from the history module.
export { workoutYmd };

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeekBucket = {
  weekStart: Date; // absolute instant of local midnight in the couple's zone
  weekEnd: Date; // exclusive
  startYmd: string;
  endYmd: string;
  // 7 for normal weeks. 8-13 for the extended transition bucket that absorbs
  // the leftover days when the user changes their week start day.
  dayCount: number;
  isTransition: boolean;
  workouts: Workout[];
  // Index i = bucket.startYmd + i days. Length === dayCount.
  byDay: Workout[][];
};

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
  tz: string,
  now: Date = new Date(),
): WeekBucket[] {
  const pairYmd = getPairedAnchorYmd(partnership, tz);
  if (!pairYmd) return [];
  const boundaries = getPartnershipWeekBoundaries(partnership, anchorHistory, tz, now);
  if (boundaries.length === 0) return [];

  const buckets: WeekBucket[] = boundaries.map((b) => ({
    weekStart: b.weekStart,
    weekEnd: b.weekEnd,
    startYmd: b.startYmd,
    endYmd: b.endYmd,
    dayCount: b.dayCount,
    isTransition: b.isTransition,
    workouts: [],
    byDay: Array.from({ length: b.dayCount }, () => [] as Workout[]),
  }));

  for (const w of workouts) {
    const ymd = workoutYmd(w, tz);
    if (!ymd) continue;
    if (diffZonedDays(ymd, pairYmd) < 0) continue;

    // Binary search for the bucket containing this day.
    let lo = 0;
    let hi = buckets.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = buckets[mid];
      if (diffZonedDays(ymd, b.startYmd) < 0) hi = mid - 1;
      else if (diffZonedDays(ymd, b.endYmd) >= 0) lo = mid + 1;
      else {
        found = mid;
        break;
      }
    }
    if (found < 0) continue;
    const bucket = buckets[found];
    bucket.workouts.push(w);
    // Calendar-day offset, so a DST transition inside the bucket can't push a
    // workout into the previous day's column.
    const dayIdx = diffZonedDays(ymd, bucket.startYmd);
    if (dayIdx >= 0 && dayIdx < bucket.dayCount) {
      bucket.byDay[dayIdx].push(w);
    }
  }

  return buckets.slice().reverse();
}

// Group workouts by calendar day (YYYY-MM-DD) in the couple's zone. Within
// each day, workouts are sorted ASC by logged_at so callers can pick `[0]` as
// "earliest of day".
export function bucketWorkoutsByDay(
  workouts: Workout[],
  tz: string,
): Record<string, Workout[]> {
  const out: Record<string, Workout[]> = {};
  for (const w of workouts) {
    const key = workoutYmd(w, tz);
    if (!key) continue;
    (out[key] ??= []).push(w);
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => +new Date(a.logged_at) - +new Date(b.logged_at));
  }
  return out;
}

// True iff both partners individually logged >= `target` distinct workout
// days within the supplied week's workout list. Counts distinct calendar
// days so the math is correct for transition buckets that span more than 7.
export function partnershipWeekGoalHit(
  weekWorkouts: Workout[],
  aId: string | null | undefined,
  bId: string | null | undefined,
  target: number,
  tz: string,
): boolean {
  if (!aId || !bId || target <= 0) return false;
  const { a, b } = distinctDaysPerUser(weekWorkouts, aId, bId, tz);
  return a >= target && b >= target;
}

// Distinct workout days per user for a given week's workout list.
export function distinctDaysPerUser(
  weekWorkouts: Workout[],
  aId: string | null | undefined,
  bId: string | null | undefined,
  tz: string,
): { a: number; b: number } {
  const aDays = new Set<string>();
  const bDays = new Set<string>();
  for (const w of weekWorkouts) {
    const key = workoutYmd(w, tz);
    if (!key) continue;
    if (aId && w.user_id === aId) aDays.add(key);
    else if (bId && w.user_id === bId) bDays.add(key);
  }
  return { a: aDays.size, b: bDays.size };
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "Nov 13 - Nov 19" from the bucket's calendar edges. Takes ymd strings so the
// label matches the couple's zone rather than the reader's.
export function formatWeekRange(startYmd: string, endYmd: string): string {
  const last = addZonedDays(endYmd, -1);
  const s = zonedMonthDay(startYmd);
  const e = zonedMonthDay(last);
  return `${MONTHS_SHORT[s.month - 1]} ${s.day} - ${MONTHS_SHORT[e.month - 1]} ${e.day}`;
}

// Label for a single day cell, e.g. "Nov 13".
export function formatDayLabel(ymd: string): string {
  const { month, day } = zonedMonthDay(ymd);
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}
