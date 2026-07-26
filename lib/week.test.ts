import { describe, expect, it } from 'vitest';

import {
  bucketWorkoutsByPartnershipWeek,
  distinctDaysPerUser,
  partnershipWeekGoalHit,
} from './historyWeek';
import {
  getCurrentWeekStartDay,
  getPartnershipWeekBoundaries,
  getWeekWindow,
  partnershipWeekStreak,
  resolveWeekTimezone,
  workoutYmd,
} from './week';
import { addZonedDays, zonedMidnightUtc, zonedYmd } from './zonedTime';
import type { Partnership, Workout } from '@/types/db';

const LA = 'America/Los_Angeles';
const TOKYO = 'Asia/Tokyo';
const HOUR_MS = 3_600_000;

const USER_A = 'user-a';
const USER_B = 'user-b';

function partnership(overrides: Partial<Partnership> = {}): Partnership {
  const pairedAt = zonedMidnightUtc('2026-07-01', LA);
  return {
    id: 'p-1',
    user_a: USER_A,
    user_b: USER_B,
    invite_code: 'ABC123',
    status: 'active',
    weekly_target: 3,
    wager_quantity: 1,
    wager_text: 'Massage',
    wager_emoji: '😺',
    created_at: pairedAt.toISOString(),
    paired_at: pairedAt.toISOString(),
    week_anchor_at: null,
    week_anchor_pending_at: null,
    wager_ledger_since: pairedAt.toISOString(),
    timezone: LA,
    ...overrides,
  };
}

// A workout at a given local hour on a given calendar day in `tz`.
function workoutAt(userId: string, ymd: string, hour: number, tz: string): Workout {
  return {
    id: `${userId}-${ymd}-${hour}`,
    user_id: userId,
    partnership_id: 'p-1',
    selfie_path: 's.jpg',
    environment_path: null,
    caption: null,
    logged_at: new Date(zonedMidnightUtc(ymd, tz).getTime() + hour * HOUR_MS).toISOString(),
    // Stamped in the zone the logger was standing in, as the trigger does.
    logged_date: ymd,
    logged_tz: tz,
  };
}

describe('resolveWeekTimezone', () => {
  it('prefers the partnership zone over the profile zone', () => {
    const p = partnership({ timezone: TOKYO });
    const profile = { timezone: LA } as any;
    expect(resolveWeekTimezone(p, profile)).toBe(TOKYO);
  });

  it('falls back to the profile zone when the partnership has none', () => {
    const p = partnership({ timezone: null });
    const profile = { timezone: TOKYO } as any;
    expect(resolveWeekTimezone(p, profile)).toBe(TOKYO);
  });

  it('returns a usable zone when neither is set', () => {
    expect(typeof resolveWeekTimezone(null, null)).toBe('string');
    expect(resolveWeekTimezone(null, null).length).toBeGreaterThan(0);
  });
});

// B1 — the headline bug. paired_at is a UTC instant; each device used to
// re-derive "midnight" in its own zone, so partners permanently disagreed
// about which day of the week their week started on.
describe('B1: partners agree on the week start day', () => {
  it('resolves the same anchor day regardless of which device asks', () => {
    // 2026-07-01T04:00Z — Jun 30 21:00 in LA, Jul 1 13:00 in Tokyo.
    const p = partnership({
      paired_at: '2026-07-01T04:00:00.000Z',
      created_at: '2026-07-01T04:00:00.000Z',
      timezone: LA,
    });

    // Both devices pass the PARTNERSHIP zone, so both get the same answer.
    const fromDeviceA = getCurrentWeekStartDay(p, p.timezone!);
    const fromDeviceB = getCurrentWeekStartDay(p, p.timezone!);
    expect(fromDeviceA).toBe(fromDeviceB);

    // And it is the LA day (Tuesday Jun 30), not the Tokyo day (Wednesday).
    expect(zonedYmd(p.paired_at!, LA)).toBe('2026-06-30');
    expect(fromDeviceA).toBe(2); // Tuesday
  });

  it('would disagree if each device used its own zone (documents the old bug)', () => {
    const p = partnership({ paired_at: '2026-07-01T04:00:00.000Z' });
    expect(getCurrentWeekStartDay(p, LA)).not.toBe(getCurrentWeekStartDay(p, TOKYO));
  });
});

// B5 — floor((today - anchor) / 86_400_000) on two local midnights yields 6
// for 7 calendar days across a spring-forward, so the week never rolled over.
describe('B5: week rollover survives DST spring-forward', () => {
  it('advances the window exactly 7 calendar days across the transition', () => {
    // US DST begins Sun 2026-03-08. Anchor on Thu 2026-03-05.
    const p = partnership({
      paired_at: zonedMidnightUtc('2026-03-05', LA).toISOString(),
      timezone: LA,
    });

    // Day 6 (Wed Mar 11) — still week 1.
    const beforeRollover = getWeekWindow(
      p,
      LA,
      new Date(zonedMidnightUtc('2026-03-11', LA).getTime() + 12 * HOUR_MS),
    );
    expect(beforeRollover?.startYmd).toBe('2026-03-05');

    // Day 7 (Thu Mar 12) — must roll to week 2. The old math returned
    // 2026-03-05 here because 7 local days spanned only 167 hours.
    const afterRollover = getWeekWindow(
      p,
      LA,
      new Date(zonedMidnightUtc('2026-03-12', LA).getTime() + 12 * HOUR_MS),
    );
    expect(afterRollover?.startYmd).toBe('2026-03-12');
  });

  it('also rolls over correctly across a fall-back', () => {
    // US DST ends Sun 2026-11-01. Anchor Thu 2026-10-29.
    const p = partnership({
      paired_at: zonedMidnightUtc('2026-10-29', LA).toISOString(),
      timezone: LA,
    });
    const w = getWeekWindow(
      p,
      LA,
      new Date(zonedMidnightUtc('2026-11-05', LA).getTime() + 12 * HOUR_MS),
    );
    expect(w?.startYmd).toBe('2026-11-05');
  });

  it('every generated boundary is exactly 7 calendar days wide', () => {
    const p = partnership({
      paired_at: zonedMidnightUtc('2026-02-05', LA).toISOString(),
      timezone: LA,
    });
    const boundaries = getPartnershipWeekBoundaries(
      p,
      [],
      LA,
      new Date(zonedMidnightUtc('2026-04-16', LA).getTime() + 12 * HOUR_MS),
    );
    expect(boundaries.length).toBeGreaterThan(8); // spans the DST change
    for (const b of boundaries) {
      expect(b.dayCount).toBe(7);
      expect(addZonedDays(b.startYmd, 7)).toBe(b.endYmd);
    }
  });
});

// B6 — the byDay index came from ms division between two local midnights, so
// after a spring-forward inside the bucket a workout landed one column early.
describe('B6: byDay indices are correct across DST', () => {
  it('places each workout in its own calendar-day column', () => {
    const p = partnership({
      paired_at: zonedMidnightUtc('2026-03-05', LA).toISOString(),
      timezone: LA,
    });
    // One workout per day across the spring-forward week.
    const ymds = [
      '2026-03-05', '2026-03-06', '2026-03-07',
      '2026-03-08', // DST transition day
      '2026-03-09', '2026-03-10', '2026-03-11',
    ];
    const workouts = ymds.map((d) => workoutAt(USER_A, d, 12, LA));

    const buckets = bucketWorkoutsByPartnershipWeek(
      workouts,
      p,
      [],
      LA,
      new Date(zonedMidnightUtc('2026-03-11', LA).getTime() + 18 * HOUR_MS),
    );
    const week = buckets.find((b) => b.startYmd === '2026-03-05');
    expect(week).toBeDefined();
    expect(week!.workouts).toHaveLength(7);
    // Exactly one workout in each of the 7 day columns, in order.
    expect(week!.byDay.map((d) => d.length)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    week!.byDay.forEach((dayWorkouts, i) => {
      expect(zonedYmd(dayWorkouts[0].logged_at, LA)).toBe(ymds[i]);
    });
  });
});

// B3 — day attribution used the reader's zone, so distinct-day counts (and
// therefore goal-hit verdicts) could differ between the two partners.
describe('B3: goal-hit and streak agree across devices', () => {
  const p = partnership();
  // Three workouts each, one of them right at the UTC day boundary.
  const workouts: Workout[] = [
    workoutAt(USER_A, '2026-07-01', 9, LA),
    workoutAt(USER_A, '2026-07-02', 23, LA), // 23:00 PT — already next day UTC
    workoutAt(USER_A, '2026-07-03', 9, LA),
    workoutAt(USER_B, '2026-07-01', 9, LA),
    workoutAt(USER_B, '2026-07-02', 9, LA),
    workoutAt(USER_B, '2026-07-03', 9, LA),
  ];

  it('both devices count the same distinct days', () => {
    const a = distinctDaysPerUser(workouts, USER_A, USER_B, p.timezone!);
    const b = distinctDaysPerUser(workouts, USER_A, USER_B, p.timezone!);
    expect(a).toEqual(b);
    expect(a).toEqual({ a: 3, b: 3 });
  });

  it('both devices reach the same goal-hit verdict', () => {
    expect(partnershipWeekGoalHit(workouts, USER_A, USER_B, 3, p.timezone!)).toBe(true);
  });

  it('the zone changes WHICH days a workout counts for', () => {
    // Not the count here, but the identity of the days — that shift is what
    // moves a workout across a week boundary and desyncs the two partners.
    const laDays = workouts
      .filter((w) => w.user_id === USER_A)
      .map((w) => zonedYmd(w.logged_at, LA));
    const tokyoDays = workouts
      .filter((w) => w.user_id === USER_A)
      .map((w) => zonedYmd(w.logged_at, TOKYO));
    expect(laDays).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(tokyoDays).toEqual(['2026-07-02', '2026-07-03', '2026-07-04']);
    expect(laDays).not.toEqual(tokyoDays);
  });

  // Once a workout carries its own stamped date, the reader's zone stops
  // mattering entirely — which is the whole point of stamping.
  it('a STAMPED boundary workout lands in the same week from either zone', () => {
    // Last day of the couple's week at 23:00 local — the case that used to
    // split partners, since it's already the next day in Tokyo.
    const lateOnLastDay = workoutAt(USER_A, '2026-07-07', 23, LA);
    const now = new Date(zonedMidnightUtc('2026-07-20', LA).getTime() + 12 * HOUR_MS);

    const inLa = bucketWorkoutsByPartnershipWeek([lateOnLastDay], p, [], LA, now);
    const inTokyo = bucketWorkoutsByPartnershipWeek([lateOnLastDay], p, [], TOKYO, now);

    const laWeek = inLa.find((b) => b.workouts.length > 0)?.startYmd;
    const tokyoWeek = inTokyo.find((b) => b.workouts.length > 0)?.startYmd;
    expect(laWeek).toBeDefined();
    expect(laWeek).toBe(tokyoWeek);
  });

  it('an UNSTAMPED legacy row still depends on the reader — why backfill matters', () => {
    // Pre-0027 rows have no logged_date and fall back to deriving from the
    // instant, so they remain reader-dependent until the backfill runs.
    const stamped = workoutAt(USER_A, '2026-07-07', 23, LA);
    const legacy: Workout = { ...stamped, logged_date: null, logged_tz: null };
    const now = new Date(zonedMidnightUtc('2026-07-20', LA).getTime() + 12 * HOUR_MS);

    const inLa = bucketWorkoutsByPartnershipWeek([legacy], p, [], LA, now);
    const inTokyo = bucketWorkoutsByPartnershipWeek([legacy], p, [], TOKYO, now);

    const laWeek = inLa.find((b) => b.workouts.length > 0)?.startYmd;
    const tokyoWeek = inTokyo.find((b) => b.workouts.length > 0)?.startYmd;
    expect(laWeek).not.toBe(tokyoWeek);
  });

  it("a Tokyo partner's Tuesday morning reads as Tuesday for BOTH partners", () => {
    // The complaint this whole change exists to fix. Sam is in Tokyo and trains
    // at 8am Tuesday. That same instant is Monday 4pm in Los Angeles, so the
    // old partnership-zone model filed it under Monday — contradicting what Sam
    // actually did.
    const sam = workoutAt(USER_B, '2026-07-07', 8, TOKYO);

    // Derived from the instant in the couple's zone, this is the WRONG answer
    // the app used to give:
    expect(zonedYmd(sam.logged_at, LA)).toBe('2026-07-06'); // Monday

    // The stamp is what both devices actually read, and it says Tuesday.
    expect(workoutYmd(sam, LA)).toBe('2026-07-07');
    expect(workoutYmd(sam, TOKYO)).toBe('2026-07-07');

    // And it counts as one distinct day for Sam from either partner's device.
    expect(distinctDaysPerUser([sam], USER_A, USER_B, LA).b).toBe(1);
    expect(distinctDaysPerUser([sam], USER_A, USER_B, TOKYO).b).toBe(1);
  });

  it('a stamped date wins over anything derivable from the instant', () => {
    // Deliberately contradictory: the instant says one day, the stamp says
    // another. The stamp is authoritative — that immutability is what makes
    // changing your timezone safe.
    const w: Workout = {
      ...workoutAt(USER_A, '2026-07-02', 9, LA),
      logged_date: '2026-07-04',
      logged_tz: TOKYO,
    };
    expect(workoutYmd(w, LA)).toBe('2026-07-04');
    expect(workoutYmd(w, TOKYO)).toBe('2026-07-04');
  });

  it('both devices compute the same streak', () => {
    const now = new Date(zonedMidnightUtc('2026-07-15', LA).getTime() + 12 * HOUR_MS);
    const s1 = partnershipWeekStreak(workouts, p, [], USER_A, USER_B, 3, p.timezone!, now);
    const s2 = partnershipWeekStreak(workouts, p, [], USER_A, USER_B, 3, p.timezone!, now);
    expect(s1).toBe(s2);
    expect(s1).toBe(1); // the first week was a joint goal-hit
  });
});

describe('week windows are contiguous and anchored', () => {
  it('the current window contains today and spans 7 days', () => {
    const p = partnership();
    const now = new Date(zonedMidnightUtc('2026-07-16', LA).getTime() + 15 * HOUR_MS);
    const w = getWeekWindow(p, LA, now);
    expect(w).not.toBeNull();
    expect(w!.dayCount).toBe(7);
    expect(now.getTime()).toBeGreaterThanOrEqual(w!.weekStart.getTime());
    expect(now.getTime()).toBeLessThan(w!.weekEnd.getTime());
    // Anchored on the paired-at weekday (Wed Jul 1 2026).
    expect(zonedYmd(w!.weekStart, LA)).toBe('2026-07-15');
  });

  it('boundaries tile without gaps or overlaps', () => {
    const p = partnership();
    const boundaries = getPartnershipWeekBoundaries(
      p,
      [],
      LA,
      new Date(zonedMidnightUtc('2026-08-12', LA).getTime() + 12 * HOUR_MS),
    );
    for (let i = 1; i < boundaries.length; i++) {
      expect(boundaries[i].startYmd).toBe(boundaries[i - 1].endYmd);
    }
  });
});
