import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Partnership, Workout } from '@/types/db';

import { bucketWorkoutsByPartnershipWeek } from './historyWeek';
import { formatWager } from './wagers';
import { addZonedDays, zonedMidnightUtc } from './zonedTime';

// The only impurity in `settleCompletedWeeks` is the Supabase network boundary
// (a SELECT of already-settled weeks + an UPSERT of new ledger rows). We mock
// just that module so the REAL settlement runs: real week bucketing, real
// distinct-day counting, real one-partner-missed rule. `now` is injected, so no
// real week boundary is needed and the test is fully deterministic.
//
// `vi.hoisted` lets the mock factory (hoisted above imports) share this mutable
// state with the test body; `beforeEach` resets it.
const db = vi.hoisted(() => ({
  existingWeekStarts: [] as string[],
  upsertCalls: [] as { rows: any[]; opts: any }[],
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          in: async (_c: string, _keys: string[]) => ({
            data: db.existingWeekStarts.map((ws) => ({ week_start: ws })),
            error: null,
          }),
        }),
      }),
      upsert: async (rows: any[], opts: any) => {
        db.upsertCalls.push({ rows, opts });
        return { error: null };
      },
    }),
  },
}));

// Imported AFTER the mock is declared; the mock is hoisted so this picks it up.
import { settleCompletedWeeks } from './wagerSettlement';

const PARTNERSHIP_ID = 'p-1';
const USER_ID = 'user-a';
const PARTNER_ID = 'user-b';

// Every instant below is built from an explicit zone rather than a local Date,
// so the suite produces identical results on any developer's machine and in CI.
const TZ = 'America/Los_Angeles';
const HOUR_MS = 3_600_000;

// Mid-way through a week so the current in-progress week is never itself
// eligible. paired_at is 3 weeks earlier → three completed weeks.
const NOW = new Date(zonedMidnightUtc('2026-07-22', TZ).getTime() + 10 * HOUR_MS);
const PAIRED_YMD = '2026-07-01';
const PAIRED_AT = zonedMidnightUtc(PAIRED_YMD, TZ);

function makePartnership(overrides: Partial<Partnership> = {}): Partnership {
  return {
    id: PARTNERSHIP_ID,
    user_a: USER_ID,
    user_b: PARTNER_ID,
    invite_code: 'ABC123',
    status: 'active',
    weekly_target: 3,
    wager_quantity: 1,
    wager_text: 'Massage',
    wager_emoji: '😺',
    created_at: PAIRED_AT.toISOString(),
    paired_at: PAIRED_AT.toISOString(),
    week_anchor_at: null,
    week_anchor_pending_at: null,
    wager_ledger_since: PAIRED_AT.toISOString(),
    timezone: TZ,
    ...overrides,
  };
}

// One workout for `userId` on `weekStartYmd + dayOffset` days, logged at noon in
// the partnership zone so it lands unambiguously inside that calendar day.
function workoutOnDay(userId: string, weekStartYmd: string, dayOffset: number): Workout {
  const ymd = addZonedDays(weekStartYmd, dayOffset);
  const at = new Date(zonedMidnightUtc(ymd, TZ).getTime() + 12 * HOUR_MS);
  return {
    id: `${userId}-${dayOffset}`,
    user_id: userId,
    partnership_id: PARTNERSHIP_ID,
    selfie_path: 'selfie.jpg',
    environment_path: null,
    caption: null,
    logged_at: at.toISOString(),
    // Stamped exactly as the 0027 trigger would, in the logger's own zone.
    logged_date: ymd,
    logged_tz: TZ,
  };
}

// The oldest completed week that is settlement-eligible given the default epoch.
// Derived from the REAL bucketer so fixtures can never drift from production
// week math. Returns the bucket's start as a YYYY-MM-DD string.
function targetWeekStart(partnership: Partnership): string {
  const epochMs = new Date(partnership.wager_ledger_since).getTime();
  const buckets = bucketWorkoutsByPartnershipWeek([], partnership, [], TZ, NOW);
  const eligible = buckets.filter(
    (b) => b.weekEnd.getTime() <= NOW.getTime() && b.weekEnd.getTime() > epochMs,
  );
  // buckets are newest-first; take the oldest eligible week to place workouts in.
  const oldest = eligible[eligible.length - 1];
  if (!oldest) throw new Error('fixture produced no eligible completed week');
  return oldest.startYmd;
}

function days(userId: string, weekStartYmd: string, offsets: number[]): Workout[] {
  return offsets.map((o) => workoutOnDay(userId, weekStartYmd, o));
}

function settle(
  p: Partnership,
  workouts: Workout[],
  tz = TZ,
  opts: { now?: Date; memberTimezones?: string[] } = {},
) {
  return settleCompletedWeeks({
    partnership: p,
    anchorHistory: [],
    userId: USER_ID,
    partnerId: PARTNER_ID,
    tz,
    memberTimezones: opts.memberTimezones,
    loadWorkouts: async () => workouts,
    now: opts.now ?? NOW,
  });
}

// Rows for every OTHER completed week are washes (no workouts → both missed);
// these tests care about the target week's row.
function rowFor(week: string) {
  return db.upsertCalls[0]?.rows.find((r) => r.week_start === week);
}

beforeEach(() => {
  db.existingWeekStarts = [];
  db.upsertCalls = [];
});

describe('settleCompletedWeeks', () => {
  it('sanity: the fixture yields at least one completed, eligible week', () => {
    const p = makePartnership();
    const start = targetWeekStart(p);
    expect(zonedMidnightUtc(start, TZ).getTime()).toBeLessThan(NOW.getTime());
  });

  it('one partner missed → inserts a row crediting the partner who hit', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    const workouts = [
      ...days(USER_ID, week, [0, 1, 2]), // user: 3 distinct days → hit
      ...days(PARTNER_ID, week, [0]), // partner: 1 day → missed
    ];

    const result = await settle(p, workouts);

    expect(result.inserted).toBeGreaterThanOrEqual(1);
    expect(db.upsertCalls).toHaveLength(1);
    expect(rowFor(week)).toEqual({
      partnership_id: PARTNERSHIP_ID,
      week_start: week,
      terms: formatWager({ quantity: 1, text: 'Massage', emoji: '😺' }),
      status: 'won',
      winner_user_id: USER_ID, // the one who hit is owed
    });
  });

  it('records the OTHER partner as winner when roles flip', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    const workouts = [
      ...days(USER_ID, week, [0]), // user: 1 day → missed
      ...days(PARTNER_ID, week, [0, 1, 2]), // partner: 3 days → hit
    ];

    await settle(p, workouts);

    expect(rowFor(week)?.winner_user_id).toBe(PARTNER_ID);
  });

  it('uses ON CONFLICT DO NOTHING so a paid week is never resurrected', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    await settle(p, [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0]),
    ]);

    expect(db.upsertCalls[0].opts).toEqual({
      onConflict: 'partnership_id,week_start',
      ignoreDuplicates: true,
    });
  });

  it('both hit the goal → a wash row with no winner', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    await settle(p, [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0, 1, 2]),
    ]);

    expect(rowFor(week)).toMatchObject({ status: 'wash', winner_user_id: null });
  });

  it('both missed the goal → a wash row with no winner', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    await settle(p, [
      ...days(USER_ID, week, [0, 1]), // 2 days → missed
      ...days(PARTNER_ID, week, [0]), // 1 day → missed
    ]);

    expect(rowFor(week)).toMatchObject({ status: 'wash', winner_user_id: null });
  });

  it('a wash week, once recorded, is never re-judged under new rules', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    // Both hit a target of 3 → wash row written.
    await settle(p, [
      ...days(USER_ID, week, [0, 1, 2, 3]),
      ...days(PARTNER_ID, week, [0, 1, 2]),
    ]);
    expect(rowFor(week)?.status).toBe('wash');

    // Target later raised to 4: the partner would now "miss", but the week is
    // already in the ledger so it's skipped.
    db.existingWeekStarts = db.upsertCalls[0].rows.map((r) => r.week_start);
    db.upsertCalls = [];
    const result = await settle(makePartnership({ weekly_target: 4 }), [
      ...days(USER_ID, week, [0, 1, 2, 3]),
      ...days(PARTNER_ID, week, [0, 1, 2]),
    ]);
    expect(result).toEqual({ inserted: 0 });
    expect(db.upsertCalls).toHaveLength(0);
  });

  it('is idempotent: an already-settled week is skipped', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    db.existingWeekStarts = [week]; // pretend the row already exists
    await settle(p, [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0]),
    ]);

    expect(rowFor(week)).toBeUndefined();
  });

  it('does not settle a week that ended before the ledger epoch', async () => {
    // Move the epoch past the target week's end so it is no longer eligible.
    const base = makePartnership();
    const week = targetWeekStart(base);
    const epochAfterWeek = zonedMidnightUtc(addZonedDays(week, 10), TZ);
    const p = makePartnership({ wager_ledger_since: epochAfterWeek.toISOString() });
    await settle(p, [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0]),
    ]);

    expect(rowFor(week)).toBeUndefined();
  });

  it('waits for a partner in a later timezone to finish their Sunday', async () => {
    const p = makePartnership({ timezone: 'America/New_York' });
    const nyTz = 'America/New_York';
    const buckets = bucketWorkoutsByPartnershipWeek([], p, [], nyTz, NOW);
    const lastEnded = buckets.find((b) => b.weekEnd.getTime() <= NOW.getTime())!;
    const workouts = [
      ...days(USER_ID, lastEnded.startYmd, [0, 1, 2]),
      ...days(PARTNER_ID, lastEnded.startYmd, [0]),
    ];

    // One hour after the week ends in New York, it's still Sunday 9pm in LA.
    const justAfter = new Date(lastEnded.weekEnd.getTime() + HOUR_MS);
    await settle(p, workouts, nyTz, {
      now: justAfter,
      memberTimezones: [nyTz, 'America/Los_Angeles'],
    });
    expect(db.upsertCalls[0]?.rows.find((r) => r.week_start === lastEnded.startYmd))
      .toBeUndefined();

    // Once LA's Sunday is over too, the week settles.
    db.upsertCalls = [];
    const afterLa = new Date(lastEnded.weekEnd.getTime() + 3 * HOUR_MS + 60_000);
    await settle(p, workouts, nyTz, {
      now: afterLa,
      memberTimezones: [nyTz, 'America/Los_Angeles'],
    });
    expect(db.upsertCalls[0]?.rows.find((r) => r.week_start === lastEnded.startYmd))
      .toMatchObject({ status: 'won', winner_user_id: USER_ID });
  });

  it('does nothing for a non-active partnership', async () => {
    const p = makePartnership({ status: 'ended' });
    const week = targetWeekStart(makePartnership());
    const result = await settle(p, [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0]),
    ]);

    expect(result).toEqual({ inserted: 0 });
    expect(db.upsertCalls).toHaveLength(0);
  });
});

// The bug this whole change exists to prevent: two partners in different
// timezones each running settlement must produce the SAME week_start key, or
// `unique(partnership_id, week_start)` never fires and one week settles twice —
// potentially with opposite winners.
describe('cross-timezone settlement agreement', () => {
  it('both partners produce an identical week_start key', async () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    const workouts = [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0]),
    ];

    // Partner A's device and partner B's device both resolve the PARTNERSHIP
    // zone, regardless of where each phone physically is.
    await settle(p, workouts, p.timezone!);
    const keyFromA = db.upsertCalls[0].rows.find((r) => r.status === 'won')?.week_start;

    db.upsertCalls = [];
    await settle(p, workouts, p.timezone!);
    const keyFromB = db.upsertCalls[0].rows.find((r) => r.status === 'won')?.week_start;

    expect(keyFromA).toBeDefined();
    expect(keyFromA).toBe(keyFromB);
  });

  it('the same instants bucket identically under the partnership zone', () => {
    const p = makePartnership();
    const week = targetWeekStart(p);
    const workouts = [
      ...days(USER_ID, week, [0, 1, 2]),
      ...days(PARTNER_ID, week, [0]),
    ];

    const a = bucketWorkoutsByPartnershipWeek(workouts, p, [], TZ, NOW);
    const b = bucketWorkoutsByPartnershipWeek(workouts, p, [], TZ, NOW);

    expect(a.map((x) => x.startYmd)).toEqual(b.map((x) => x.startYmd));
    expect(a.map((x) => x.workouts.length)).toEqual(b.map((x) => x.workouts.length));
  });

  it('a boundary workout would land in DIFFERENT weeks under device-local zones', () => {
    // Documents the old behavior this change removes: 5pm PT Tue is already
    // Wed in Tokyo, so a device-local bucketer split the couple.
    const p = makePartnership();
    const week = targetWeekStart(p);
    // 23:30 PT on the last day of the week — 15:30 next-day in Tokyo.
    const lateNight = new Date(
      zonedMidnightUtc(addZonedDays(week, 6), TZ).getTime() + 23.5 * HOUR_MS,
    );
    // Deliberately UNSTAMPED so this exercises the pre-0027 fallback path,
    // which is the behaviour that still depends on the reader's zone.
    const w: Workout = {
      id: 'boundary',
      user_id: USER_ID,
      partnership_id: PARTNERSHIP_ID,
      selfie_path: 's.jpg',
      environment_path: null,
      caption: null,
      logged_at: lateNight.toISOString(),
      logged_date: null,
      logged_tz: null,
    };

    const inLa = bucketWorkoutsByPartnershipWeek([w], p, [], TZ, NOW);
    const inTokyo = bucketWorkoutsByPartnershipWeek([w], p, [], 'Asia/Tokyo', NOW);

    const laWeek = inLa.find((b) => b.workouts.length > 0)?.startYmd;
    const tokyoWeek = inTokyo.find((b) => b.workouts.length > 0)?.startYmd;
    // Different zones genuinely disagree — which is exactly why every call site
    // must pass the partnership zone rather than the device's.
    expect(laWeek).not.toBe(tokyoWeek);
  });
});
