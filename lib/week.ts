import type {
  Partnership,
  PartnershipAnchorHistory,
  Profile,
  WeekProgress,
  WeekdayKey,
  Workout,
} from '@/types/db';

const MS_PER_DAY = 86_400_000;

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

function toLocalMidnight(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// 00:00 local of the day the couple paired. Used to drop pre-pair workouts;
// unaffected by later week_anchor changes.
export function getPairedAnchor(
  partnership: Partnership | null | undefined,
): Date | null {
  if (!partnership?.paired_at) return null;
  return toLocalMidnight(partnership.paired_at);
}

// 00:00 local of the active week anchor. `week_anchor_at` wins; otherwise we
// fall back to `paired_at`. Represents the start of every 7-day cycle outside
// of an active extension window.
export function getEffectiveAnchor(
  partnership: Partnership | null | undefined,
): Date | null {
  if (!partnership) return null;
  if (partnership.week_anchor_at) return toLocalMidnight(partnership.week_anchor_at);
  return getPairedAnchor(partnership);
}

// 00:00 local of the pending week-anchor change, if one is scheduled.
export function getPendingAnchor(
  partnership: Partnership | null | undefined,
): Date | null {
  if (!partnership?.week_anchor_pending_at) return null;
  return toLocalMidnight(partnership.week_anchor_pending_at);
}

// JS-Day (Sun=0..Sat=6) that the couple's weeks start on. When a pending
// change exists, we use the *pending* day so the settings UI reflects the
// user's selection even before it takes effect.
export function getCurrentWeekStartDay(
  partnership: Partnership | null | undefined,
): number | null {
  const pending = getPendingAnchor(partnership);
  if (pending) return pending.getDay();
  const eff = getEffectiveAnchor(partnership);
  if (eff) return eff.getDay();
  return null;
}

export type AnchorEra = {
  // 00:00 local of when this era's anchor became active.
  anchorAt: Date;
  // 00:00 local of when the next era began. NULL for the open era.
  endExclusive: Date | null;
};

// Chronological list of anchor eras for a partnership. When `history` is empty
// (older partnerships predate the anchor-history table, or the data hasn't
// loaded yet) we fall back to a single open era anchored at paired_at — that
// matches the pre-migration behavior.
export function getAnchorEras(
  partnership: Partnership | null | undefined,
  history: PartnershipAnchorHistory[] | null | undefined,
): AnchorEra[] {
  const pair = getPairedAnchor(partnership);
  if (!pair) return [];
  if (!history || history.length === 0) {
    return [{ anchorAt: pair, endExclusive: null }];
  }
  const eras: AnchorEra[] = [];
  const sorted = [...history].sort(
    (a, b) => new Date(a.anchor_at).getTime() - new Date(b.anchor_at).getTime(),
  );
  for (const row of sorted) {
    const anchorAt = toLocalMidnight(row.anchor_at);
    if (!anchorAt) continue;
    const endExclusive = row.effective_until
      ? toLocalMidnight(row.effective_until)
      : null;
    eras.push({ anchorAt, endExclusive });
  }
  return eras;
}

export type WeekBoundary = {
  // 00:00 local of the bucket's first day.
  weekStart: Date;
  // 00:00 local of the day after the last day in the bucket.
  weekEnd: Date;
  // Inclusive day count. 7 for normal weeks; 8-13 for an extended transition
  // week that absorbs the leftover days when a closed era doesn't divide
  // evenly by 7 — i.e., the week during which the user's start-day change
  // takes effect.
  dayCount: number;
  isTransition: boolean;
};

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
  now: Date = new Date(),
): WeekBoundary[] {
  const eras = getAnchorEras(partnership, history);
  if (eras.length === 0) return [];
  const currentWindow = getWeekWindow(partnership, now);

  const out: WeekBoundary[] = [];

  for (let i = 0; i < eras.length; i++) {
    const era = eras[i];
    const isOpen = era.endExclusive === null;

    if (isOpen) {
      if (!currentWindow) continue;
      const currentStartMs = currentWindow.weekStart.getTime();
      let cursor = new Date(era.anchorAt);
      while (cursor.getTime() < currentStartMs) {
        const next = new Date(cursor);
        next.setDate(next.getDate() + 7);
        if (next.getTime() > currentStartMs) break;
        out.push({
          weekStart: cursor,
          weekEnd: next,
          dayCount: 7,
          isTransition: false,
        });
        cursor = next;
      }
      out.push({
        weekStart: currentWindow.weekStart,
        weekEnd: currentWindow.weekEnd,
        dayCount: currentWindow.dayCount,
        isTransition: currentWindow.isExtendedWeek,
      });
      continue;
    }

    const endMs = era.endExclusive!.getTime();
    let cursor = new Date(era.anchorAt);
    let lastIdx = -1;
    while (true) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 7);

      if (next.getTime() === endMs) {
        out.push({
          weekStart: cursor,
          weekEnd: next,
          dayCount: 7,
          isTransition: false,
        });
        break;
      }

      if (next.getTime() > endMs) {
        // Adding another full week would overshoot. Either extend the most
        // recent bucket to swallow the leftover days, or — if no full week
        // landed in this era — emit a single short bucket spanning the era.
        if (lastIdx >= 0) {
          const prev = out[lastIdx];
          const newEnd = era.endExclusive!;
          const dayCount = Math.round(
            (newEnd.getTime() - prev.weekStart.getTime()) / MS_PER_DAY,
          );
          out[lastIdx] = {
            weekStart: prev.weekStart,
            weekEnd: newEnd,
            dayCount,
            isTransition: dayCount > 7,
          };
        } else {
          const dayCount = Math.round((endMs - era.anchorAt.getTime()) / MS_PER_DAY);
          out.push({
            weekStart: era.anchorAt,
            weekEnd: era.endExclusive!,
            dayCount,
            isTransition: true,
          });
        }
        break;
      }

      out.push({
        weekStart: cursor,
        weekEnd: next,
        dayCount: 7,
        isTransition: false,
      });
      lastIdx = out.length - 1;
      cursor = next;
    }
  }

  return out;
}

// 00:00 local of the next occurrence of `targetDay` (0..6) strictly after
// `after`. If `after` already lands on `targetDay`, advances a full week.
export function nextOccurrenceOfDay(targetDay: number, after: Date): Date {
  const a = new Date(after);
  a.setHours(0, 0, 0, 0);
  const diff = ((targetDay - a.getDay() + 7) % 7) || 7;
  const out = new Date(a);
  out.setDate(out.getDate() + diff);
  return out;
}

// 00:00 local of the next occurrence of `targetDay` (0..6) on or after `from`.
// Returns `from` itself when from.getDay() === targetDay — used to anchor a
// future pending change to the end of the current cycle without skipping it.
export function nextDayOnOrAfter(targetDay: number, from: Date): Date {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const diff = (targetDay - a.getDay() + 7) % 7;
  const out = new Date(a);
  out.setDate(out.getDate() + diff);
  return out;
}

export type WeekWindow = {
  weekStart: Date;
  weekEnd: Date; // exclusive
  effectiveAnchor: Date;
  isExtendedWeek: boolean;
  pendingAnchorAt: Date | null;
  dayCount: number; // (weekEnd - weekStart) / 1d
};

// The partnership's current week window. Handles three cases:
// 1. No pending change → standard 7-day window from effective anchor.
// 2. Pending in the future → in-progress week extends until the pending date.
// 3. Pending already due (now >= pending) → treat pending as the active
//    anchor and recompute standard math. Caller is responsible for
//    persisting the promotion via `promoteWeekAnchorIfDue`.
export function getWeekWindow(
  partnership: Partnership | null | undefined,
  now: Date = new Date(),
): WeekWindow | null {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const pending = getPendingAnchor(partnership);
  if (pending && today.getTime() >= pending.getTime()) {
    const anchor = pending;
    const days = Math.floor((today.getTime() - anchor.getTime()) / MS_PER_DAY);
    const weeksSince = days < 0 ? 0 : Math.floor(days / 7);
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() + weeksSince * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return {
      weekStart,
      weekEnd,
      effectiveAnchor: anchor,
      isExtendedWeek: false,
      pendingAnchorAt: null,
      dayCount: 7,
    };
  }

  const effectiveAnchor = getEffectiveAnchor(partnership);
  if (!effectiveAnchor) return null;

  const days = Math.floor((today.getTime() - effectiveAnchor.getTime()) / MS_PER_DAY);
  const weeksSince = days < 0 ? 0 : Math.floor(days / 7);
  const weekStart = new Date(effectiveAnchor);
  weekStart.setDate(effectiveAnchor.getDate() + weeksSince * 7);

  if (pending && today.getTime() < pending.getTime()) {
    const weekEnd = pending;
    const dayCount = Math.round(
      (weekEnd.getTime() - weekStart.getTime()) / MS_PER_DAY,
    );
    return {
      weekStart,
      weekEnd,
      effectiveAnchor,
      isExtendedWeek: dayCount > 7,
      pendingAnchorAt: pending,
      dayCount,
    };
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return {
    weekStart,
    weekEnd,
    effectiveAnchor,
    isExtendedWeek: false,
    pendingAnchorAt: null,
    dayCount: 7,
  };
}

// Solo fallback for callers that need a week window without a partnership
// (e.g., the post-log success screen for an unpaired user). Anchors at 00:00
// on the most recent `weekStartDay` on or before `now` and spans 7 days.
export function getSoloWeekWindow(
  now: Date = new Date(),
  weekStartDay: number = 3,
): WeekWindow {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = (today.getDay() - weekStartDay + 7) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diff);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return {
    weekStart,
    weekEnd,
    effectiveAnchor: weekStart,
    isExtendedWeek: false,
    pendingAnchorAt: null,
    dayCount: 7,
  };
}

export function getPartnershipWeekStart(
  partnership: Partnership | null | undefined,
  now: Date = new Date(),
): Date | null {
  return getWeekWindow(partnership, now)?.weekStart ?? null;
}

export function getPartnershipWeekEnd(
  partnership: Partnership | null | undefined,
  now: Date = new Date(),
): Date | null {
  return getWeekWindow(partnership, now)?.weekEnd ?? null;
}

export function getMillisUntilNextRollover(
  partnership: Partnership | null | undefined,
  now: Date = new Date(),
): number | null {
  const end = getPartnershipWeekEnd(partnership, now);
  if (!end) return null;
  return Math.max(0, end.getTime() - now.getTime());
}

// If a pending anchor change has come due, return the field updates the
// caller should write back to the partnership row. Null when no promotion
// is needed.
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
  now: Date = new Date(),
): boolean {
  const window = getWeekWindow(partnership, now);
  const pair = getPairedAnchor(partnership);
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
// original 7-day boundaries, and the transition week is a single longer
// bucket).
export function partnershipWeekStreak(
  workouts: Workout[],
  partnership: Partnership | null | undefined,
  history: PartnershipAnchorHistory[] | null | undefined,
  aId: string | null | undefined,
  bId: string | null | undefined,
  target: number,
  now: Date = new Date(),
): number {
  if (!aId || !bId || target <= 0) return 0;
  const boundaries = getPartnershipWeekBoundaries(partnership, history, now);
  if (boundaries.length === 0) return 0;

  // Pre-bucket workouts by boundary index in one pass. Boundaries are
  // ascending and contiguous within an era, so a binary search per workout
  // is O(N log B); for the partnership sizes we care about a linear scan
  // would also be fine.
  const aDays: Set<string>[] = boundaries.map(() => new Set());
  const bDays: Set<string>[] = boundaries.map(() => new Set());

  const findIdx = (dayMs: number): number => {
    let lo = 0;
    let hi = boundaries.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = boundaries[mid];
      if (dayMs < b.weekStart.getTime()) hi = mid - 1;
      else if (dayMs >= b.weekEnd.getTime()) lo = mid + 1;
      else return mid;
    }
    return -1;
  };

  for (const w of workouts) {
    if (w.user_id !== aId && w.user_id !== bId) continue;
    const ts = new Date(w.logged_at);
    if (Number.isNaN(ts.getTime())) continue;
    const dayMs = new Date(
      ts.getFullYear(),
      ts.getMonth(),
      ts.getDate(),
    ).getTime();
    const idx = findIdx(dayMs);
    if (idx < 0) continue;
    const key = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;
    if (w.user_id === aId) aDays[idx].add(key);
    else bDays[idx].add(key);
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
  target = 3,
  weekStart: Date | null = null,
  weekEnd: Date | null = null,
): WeekProgress {
  const completedSet = new Set<WeekdayKey>();
  if (weekStart) {
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd ? weekEnd.getTime() : weekStartMs + 7 * MS_PER_DAY;
    for (const w of workouts) {
      if (w.user_id !== user.id) continue;
      const t = new Date(w.logged_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t < weekStartMs || t >= weekEndMs) continue;
      completedSet.add(getWeekdayKeyFromDate(new Date(w.logged_at)));
    }
  }

  return {
    user,
    workoutsThisWeek: completedSet.size,
    target,
    completedDays: Array.from(completedSet),
  };
}
