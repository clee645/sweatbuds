import {
  addZonedDays,
  deviceTimezone,
  diffZonedDays,
  zonedDayOfWeek,
  zonedMidnightUtc,
  zonedYmd,
} from './zonedTime';
import type {
  Partnership,
  PartnershipAnchorHistory,
  Profile,
  WeekProgress,
  WeekdayKey,
  Workout,
} from '@/types/db';

// All week math resolves calendar days against ONE timezone shared by the
// couple, never the reading device's zone. Boundaries are exposed as Date
// objects, but they are absolute UTC instants (the moment local midnight
// occurs in that zone) — so both partners' devices produce byte-identical
// boundaries and therefore identical goal-hit, streak and wager outcomes.
//
// Internally everything strides on "YYYY-MM-DD" strings via addZonedDays, so
// a 23- or 25-hour DST day never shifts a boundary.

const JS_DAY_TO_KEY: Record<number, WeekdayKey> = {
  0: 'S2',
  1: 'M',
  2: 'T2',
  3: 'W',
  4: 'T1',
  5: 'F',
  6: 'S1',
};

// The zone every calendar-day decision for this couple resolves against.
// partnership.timezone is authoritative once set; profiles.timezone is the
// pre-migration fallback; the device zone is the last resort for a brand-new
// solo user who has neither.
export function resolveWeekTimezone(
  partnership: Partnership | null | undefined,
  profile?: Profile | null,
): string {
  return partnership?.timezone || profile?.timezone || deviceTimezone();
}

// THE definition of "which day did this workout count for".
//
// `logged_date` is stamped server-side at insert in the logger's own timezone
// (migration 0027) and is immutable — a partner in Tokyo who trained Tuesday
// morning gets Tuesday, on every device, forever. Nothing here recomputes it,
// which is what makes moving cities or fixing your timezone safe.
//
// `fallbackTz` is only consulted for rows logged before 0027 shipped. Once the
// backfill completes and logged_date is NOT NULL, this parameter and every
// `tz` argument threaded through the counting functions below can be deleted.
export function workoutYmd(w: Workout, fallbackTz: string): string {
  return w.logged_date ?? zonedYmd(w.logged_at, fallbackTz);
}

export function getWeekdayKeyFromYmd(ymd: string): WeekdayKey {
  return JS_DAY_TO_KEY[zonedDayOfWeek(ymd)];
}

export function getWeekdayKeyFor(instant: Date | string, tz: string): WeekdayKey {
  return getWeekdayKeyFromYmd(zonedYmd(instant, tz));
}

// 00:00 (in `tz`) of the calendar day an instant falls on.
function anchorYmd(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null;
  const ymd = zonedYmd(iso, tz);
  return ymd || null;
}

// 00:00 of the day the couple paired. Used to drop pre-pair workouts;
// unaffected by later week_anchor changes.
export function getPairedAnchorYmd(
  partnership: Partnership | null | undefined,
  tz: string,
): string | null {
  return anchorYmd(partnership?.paired_at, tz);
}

export function getPairedAnchor(
  partnership: Partnership | null | undefined,
  tz: string,
): Date | null {
  const ymd = getPairedAnchorYmd(partnership, tz);
  return ymd ? zonedMidnightUtc(ymd, tz) : null;
}

// 00:00 of the active week anchor. `week_anchor_at` wins; otherwise we fall
// back to `paired_at`. Represents the start of every 7-day cycle outside of an
// active extension window.
export function getEffectiveAnchorYmd(
  partnership: Partnership | null | undefined,
  tz: string,
): string | null {
  if (!partnership) return null;
  if (partnership.week_anchor_at) return anchorYmd(partnership.week_anchor_at, tz);
  return getPairedAnchorYmd(partnership, tz);
}

export function getEffectiveAnchor(
  partnership: Partnership | null | undefined,
  tz: string,
): Date | null {
  const ymd = getEffectiveAnchorYmd(partnership, tz);
  return ymd ? zonedMidnightUtc(ymd, tz) : null;
}

// 00:00 of the pending week-anchor change, if one is scheduled.
export function getPendingAnchorYmd(
  partnership: Partnership | null | undefined,
  tz: string,
): string | null {
  return anchorYmd(partnership?.week_anchor_pending_at, tz);
}

export function getPendingAnchor(
  partnership: Partnership | null | undefined,
  tz: string,
): Date | null {
  const ymd = getPendingAnchorYmd(partnership, tz);
  return ymd ? zonedMidnightUtc(ymd, tz) : null;
}

// JS-Day (Sun=0..Sat=6) that the couple's weeks start on. When a pending
// change exists, we use the *pending* day so the settings UI reflects the
// user's selection even before it takes effect.
export function getCurrentWeekStartDay(
  partnership: Partnership | null | undefined,
  tz: string,
): number | null {
  const pending = getPendingAnchorYmd(partnership, tz);
  if (pending) return zonedDayOfWeek(pending);
  const eff = getEffectiveAnchorYmd(partnership, tz);
  if (eff) return zonedDayOfWeek(eff);
  return null;
}

export type AnchorEra = {
  // 00:00 of when this era's anchor became active.
  anchorYmd: string;
  // 00:00 of when the next era began. NULL for the open era.
  endExclusiveYmd: string | null;
};

// Chronological list of anchor eras for a partnership. When `history` is empty
// (older partnerships predate the anchor-history table, or the data hasn't
// loaded yet) we fall back to a single open era anchored at paired_at — that
// matches the pre-migration behavior.
export function getAnchorEras(
  partnership: Partnership | null | undefined,
  history: PartnershipAnchorHistory[] | null | undefined,
  tz: string,
): AnchorEra[] {
  const pair = getPairedAnchorYmd(partnership, tz);
  if (!pair) return [];
  if (!history || history.length === 0) {
    return [{ anchorYmd: pair, endExclusiveYmd: null }];
  }
  const eras: AnchorEra[] = [];
  const sorted = [...history].sort(
    (a, b) => new Date(a.anchor_at).getTime() - new Date(b.anchor_at).getTime(),
  );
  for (const row of sorted) {
    const a = anchorYmd(row.anchor_at, tz);
    if (!a) continue;
    eras.push({
      anchorYmd: a,
      endExclusiveYmd: row.effective_until ? anchorYmd(row.effective_until, tz) : null,
    });
  }
  return eras;
}

export type WeekBoundary = {
  // Absolute instant of the bucket's first local midnight.
  weekStart: Date;
  // Absolute instant of the local midnight after the last day (exclusive).
  weekEnd: Date;
  // Calendar-day form of the same two edges — use these for day arithmetic
  // and formatting rather than reading date parts off the Dates above, which
  // would reintroduce device-local interpretation.
  startYmd: string;
  endYmd: string;
  // Inclusive day count. 7 for normal weeks; 8-13 for an extended transition
  // week that absorbs the leftover days when a closed era doesn't divide
  // evenly by 7 — i.e., the week during which the user's start-day change
  // takes effect.
  dayCount: number;
  isTransition: boolean;
};

function boundary(
  startYmd: string,
  endYmd: string,
  tz: string,
  isTransition?: boolean,
): WeekBoundary {
  const dayCount = diffZonedDays(endYmd, startYmd);
  return {
    weekStart: zonedMidnightUtc(startYmd, tz),
    weekEnd: zonedMidnightUtc(endYmd, tz),
    startYmd,
    endYmd,
    dayCount,
    isTransition: isTransition ?? dayCount > 7,
  };
}

// Full list of partnership week buckets from paired_at through the current
// open week, ordered ascending. Within each closed era we stride 7 days from
// anchor_at; when the next 7-day stride would overrun the era's end, the LAST
// emitted bucket is *extended* (rather than being followed by a short
// trailing bucket) so the transition reads as one longer week. The open
// era's final bucket is the in-progress week from `getWeekWindow` (which may
// itself be extended via a pending pre-promotion anchor change).
export function getPartnershipWeekBoundaries(
  partnership: Partnership | null | undefined,
  history: PartnershipAnchorHistory[] | null | undefined,
  tz: string,
  now: Date = new Date(),
): WeekBoundary[] {
  const eras = getAnchorEras(partnership, history, tz);
  if (eras.length === 0) return [];
  const currentWindow = getWeekWindow(partnership, tz, now);

  const out: WeekBoundary[] = [];

  for (const era of eras) {
    const isOpen = era.endExclusiveYmd === null;

    if (isOpen) {
      if (!currentWindow) continue;
      const currentStart = currentWindow.startYmd;
      let cursor = era.anchorYmd;
      while (diffZonedDays(currentStart, cursor) > 0) {
        const next = addZonedDays(cursor, 7);
        if (diffZonedDays(next, currentStart) > 0) break;
        out.push(boundary(cursor, next, tz, false));
        cursor = next;
      }
      out.push({
        weekStart: currentWindow.weekStart,
        weekEnd: currentWindow.weekEnd,
        startYmd: currentWindow.startYmd,
        endYmd: currentWindow.endYmd,
        dayCount: currentWindow.dayCount,
        isTransition: currentWindow.isExtendedWeek,
      });
      continue;
    }

    const endYmd = era.endExclusiveYmd!;
    let cursor = era.anchorYmd;
    let lastIdx = -1;
    for (;;) {
      const next = addZonedDays(cursor, 7);
      const delta = diffZonedDays(next, endYmd);

      if (delta === 0) {
        out.push(boundary(cursor, next, tz, false));
        break;
      }

      if (delta > 0) {
        // Adding another full week would overshoot. Either extend the most
        // recent bucket to swallow the leftover days, or — if no full week
        // landed in this era — emit a single short bucket spanning the era.
        if (lastIdx >= 0) {
          const prev = out[lastIdx];
          out[lastIdx] = boundary(prev.startYmd, endYmd, tz);
        } else {
          out.push(boundary(era.anchorYmd, endYmd, tz, true));
        }
        break;
      }

      out.push(boundary(cursor, next, tz, false));
      lastIdx = out.length - 1;
      cursor = next;
    }
  }

  return out;
}

// The next occurrence of `targetDay` (0..6) strictly after `fromYmd`. If
// `fromYmd` already lands on `targetDay`, advances a full week.
export function nextOccurrenceOfDayYmd(targetDay: number, fromYmd: string): string {
  const diff = ((targetDay - zonedDayOfWeek(fromYmd) + 7) % 7) || 7;
  return addZonedDays(fromYmd, diff);
}

// The next occurrence of `targetDay` (0..6) on or after `fromYmd`. Returns
// `fromYmd` itself when it already lands on `targetDay` — used to anchor a
// future pending change to the end of the current cycle without skipping it.
export function nextDayOnOrAfterYmd(targetDay: number, fromYmd: string): string {
  const diff = (targetDay - zonedDayOfWeek(fromYmd) + 7) % 7;
  return addZonedDays(fromYmd, diff);
}

export type WeekWindow = {
  weekStart: Date;
  weekEnd: Date; // exclusive
  startYmd: string;
  endYmd: string;
  effectiveAnchorYmd: string;
  isExtendedWeek: boolean;
  pendingAnchorYmd: string | null;
  dayCount: number;
};

// The partnership's current week window. Handles three cases:
// 1. No pending change → standard 7-day window from effective anchor.
// 2. Pending in the future → in-progress week extends until the pending date.
// 3. Pending already due (now >= pending) → treat pending as the active
//    anchor and recompute standard math. Caller is responsible for
//    persisting the promotion via `promoteWeekAnchorIfDue`.
export function getWeekWindow(
  partnership: Partnership | null | undefined,
  tz: string,
  now: Date = new Date(),
): WeekWindow | null {
  const today = zonedYmd(now, tz);

  const pending = getPendingAnchorYmd(partnership, tz);
  if (pending && diffZonedDays(today, pending) >= 0) {
    const startYmd = strideToCurrent(pending, today);
    const endYmd = addZonedDays(startYmd, 7);
    return {
      weekStart: zonedMidnightUtc(startYmd, tz),
      weekEnd: zonedMidnightUtc(endYmd, tz),
      startYmd,
      endYmd,
      effectiveAnchorYmd: pending,
      isExtendedWeek: false,
      pendingAnchorYmd: null,
      dayCount: 7,
    };
  }

  const effectiveAnchor = getEffectiveAnchorYmd(partnership, tz);
  if (!effectiveAnchor) return null;

  const startYmd = strideToCurrent(effectiveAnchor, today);

  if (pending && diffZonedDays(today, pending) < 0) {
    const endYmd = pending;
    const dayCount = diffZonedDays(endYmd, startYmd);
    return {
      weekStart: zonedMidnightUtc(startYmd, tz),
      weekEnd: zonedMidnightUtc(endYmd, tz),
      startYmd,
      endYmd,
      effectiveAnchorYmd: effectiveAnchor,
      isExtendedWeek: dayCount > 7,
      pendingAnchorYmd: pending,
      dayCount,
    };
  }

  const endYmd = addZonedDays(startYmd, 7);
  return {
    weekStart: zonedMidnightUtc(startYmd, tz),
    weekEnd: zonedMidnightUtc(endYmd, tz),
    startYmd,
    endYmd,
    effectiveAnchorYmd: effectiveAnchor,
    isExtendedWeek: false,
    pendingAnchorYmd: null,
    dayCount: 7,
  };
}

// Start of the 7-day cycle containing `todayYmd`, striding from `anchorYmd`.
// Pure calendar days, so a DST transition inside the span can't drop a week.
function strideToCurrent(anchorYmd: string, todayYmd: string): string {
  const days = diffZonedDays(todayYmd, anchorYmd);
  const weeksSince = days < 0 ? 0 : Math.floor(days / 7);
  return addZonedDays(anchorYmd, weeksSince * 7);
}

// Monday. Only reached by users with no partnership and no anchor of their
// own; previously a bare `3` (Wednesday) scattered across three files.
export const DEFAULT_WEEK_START_DAY = 1;

// Solo fallback for callers that need a week window without a partnership
// (e.g., the post-log success screen for an unpaired user). Anchors at 00:00
// on the most recent `weekStartDay` on or before `now` and spans 7 days.
export function getSoloWeekWindow(
  tz: string,
  now: Date = new Date(),
  weekStartDay: number = DEFAULT_WEEK_START_DAY,
): WeekWindow {
  const today = zonedYmd(now, tz);
  const diff = (zonedDayOfWeek(today) - weekStartDay + 7) % 7;
  const startYmd = addZonedDays(today, -diff);
  const endYmd = addZonedDays(startYmd, 7);
  return {
    weekStart: zonedMidnightUtc(startYmd, tz),
    weekEnd: zonedMidnightUtc(endYmd, tz),
    startYmd,
    endYmd,
    effectiveAnchorYmd: startYmd,
    isExtendedWeek: false,
    pendingAnchorYmd: null,
    dayCount: 7,
  };
}

export function getPartnershipWeekStart(
  partnership: Partnership | null | undefined,
  tz: string,
  now: Date = new Date(),
): Date | null {
  return getWeekWindow(partnership, tz, now)?.weekStart ?? null;
}

export function getPartnershipWeekEnd(
  partnership: Partnership | null | undefined,
  tz: string,
  now: Date = new Date(),
): Date | null {
  return getWeekWindow(partnership, tz, now)?.weekEnd ?? null;
}

export function getMillisUntilNextRollover(
  partnership: Partnership | null | undefined,
  tz: string,
  now: Date = new Date(),
): number | null {
  const end = getPartnershipWeekEnd(partnership, tz, now);
  if (!end) return null;
  return Math.max(0, end.getTime() - now.getTime());
}

// If a pending anchor change has come due, return the field updates the
// caller should write back to the partnership row. Null when no promotion
// is needed. Compares absolute instants, so both devices promote at the same
// moment rather than whenever their local midnight happens to arrive.
export function promoteWeekAnchorIfDue(
  partnership: Partnership | null | undefined,
  now: Date = new Date(),
): { week_anchor_at: string; week_anchor_pending_at: null } | null {
  if (!partnership?.week_anchor_pending_at) return null;
  const pendingMs = new Date(partnership.week_anchor_pending_at).getTime();
  if (Number.isNaN(pendingMs)) return null;
  if (now.getTime() < pendingMs) return null;
  return {
    week_anchor_at: partnership.week_anchor_pending_at,
    week_anchor_pending_at: null,
  };
}

export function isInCurrentPartnershipWeek(
  loggedAtIso: string,
  partnership: Partnership | null | undefined,
  tz: string,
  now: Date = new Date(),
): boolean {
  const window = getWeekWindow(partnership, tz, now);
  const pair = getPairedAnchor(partnership, tz);
  if (!window || !pair) return false;
  const t = new Date(loggedAtIso).getTime();
  if (Number.isNaN(t)) return false;
  if (t < pair.getTime()) return false;
  return t >= window.weekStart.getTime() && t < window.weekEnd.getTime();
}

// Counts every partnership week since `paired_at` where both partners
// individually hit `target` distinct workout days. Missed weeks do not
// reset the count — they simply don't contribute. Buckets follow the
// era-aware boundary list (so weeks before an anchor change keep their
// original boundaries, and the transition week is a single longer bucket).
export function partnershipWeekStreak(
  workouts: Workout[],
  partnership: Partnership | null | undefined,
  history: PartnershipAnchorHistory[] | null | undefined,
  aId: string | null | undefined,
  bId: string | null | undefined,
  target: number,
  tz: string,
  now: Date = new Date(),
): number {
  if (!aId || !bId || target <= 0) return 0;
  const boundaries = getPartnershipWeekBoundaries(partnership, history, tz, now);
  if (boundaries.length === 0) return 0;

  const aDays: Set<string>[] = boundaries.map(() => new Set());
  const bDays: Set<string>[] = boundaries.map(() => new Set());

  const findIdx = (ymd: string): number => {
    let lo = 0;
    let hi = boundaries.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = boundaries[mid];
      if (diffZonedDays(ymd, b.startYmd) < 0) hi = mid - 1;
      else if (diffZonedDays(ymd, b.endYmd) >= 0) lo = mid + 1;
      else return mid;
    }
    return -1;
  };

  for (const w of workouts) {
    if (w.user_id !== aId && w.user_id !== bId) continue;
    const ymd = workoutYmd(w, tz);
    if (!ymd) continue;
    const idx = findIdx(ymd);
    if (idx < 0) continue;
    if (w.user_id === aId) aDays[idx].add(ymd);
    else bDays[idx].add(ymd);
  }

  let count = 0;
  for (let i = 0; i < boundaries.length; i++) {
    if (aDays[i].size >= target && bDays[i].size >= target) count += 1;
  }
  return count;
}

// Distinct days the user logged within the supplied week window. When
// `weekEnd` is provided it is used as the exclusive end (supports extended
// weeks); otherwise defaults to weekStart + 7d.
export function weekProgressFromWorkouts(
  workouts: Workout[],
  user: Profile,
  tz: string,
  target = 3,
  weekStart: Date | null = null,
  weekEnd: Date | null = null,
): WeekProgress {
  const completedSet = new Set<WeekdayKey>();
  if (weekStart) {
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd
      ? weekEnd.getTime()
      : zonedMidnightUtc(addZonedDays(zonedYmd(weekStart, tz), 7), tz).getTime();
    for (const w of workouts) {
      if (w.user_id !== user.id) continue;
      const t = new Date(w.logged_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t < weekStartMs || t >= weekEndMs) continue;
      completedSet.add(getWeekdayKeyFromYmd(workoutYmd(w, tz)));
    }
  }

  return {
    user,
    workoutsThisWeek: completedSet.size,
    target,
    completedDays: Array.from(completedSet),
  };
}
