import type { Partnership, PartnershipAnchorHistory, Workout } from '@/types/db';

import {
  bucketWorkoutsByPartnershipWeek,
  distinctDaysPerUser,
} from './historyWeek';
import { supabase } from './supabase';
import { formatWager } from './wagers';
import { tzOffsetMs } from './zonedTime';

const HOUR_MS = 3_600_000;
// Widest possible gap between two real UTC offsets (UTC-12 .. UTC+14).
export const MAX_ZONE_SPREAD_MS = 26 * HOUR_MS;

export type WorkoutRange = { fromIso: string; toIso: string };
export type LoadWorkouts = (partnershipId: string, range: WorkoutRange) => Promise<Workout[]>;

type SettleArgs = {
  partnership: Partnership | null | undefined;
  anchorHistory: PartnershipAnchorHistory[] | null | undefined;
  userId: string | null | undefined;
  partnerId: string | null | undefined;
  // The partnership's canonical zone. Both devices MUST pass the same value —
  // it determines `week_start`, which is the ledger's dedupe key.
  tz: string;
  // Zones the partners may be logging from (profile zones, this device's zone).
  // Used only to decide how long to wait after a week ends — see graceMsFor.
  memberTimezones?: (string | null | undefined)[];
  // Injected for tests; defaults to a fresh server read.
  loadWorkouts?: LoadWorkouts;
  now?: Date;
};

export type SettleResult = { inserted: number };

type LedgerRow = {
  partnership_id: string;
  week_start: string;
  terms: string;
  status: 'won' | 'wash';
  winner_user_id: string | null;
};

// Reads the partnership's workouts straight from the server for the window
// being settled. Settlement must never run off the in-memory history list: on
// a cold start that list often holds only the user's own rows (the partnership
// hasn't loaded yet), and after a background stretch it's missing whatever the
// partner logged meanwhile. Either way a week would be judged — permanently —
// with the partner's workouts missing.
export const fetchPartnershipWorkouts: LoadWorkouts = async (partnershipId, range) => {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at, logged_date, logged_tz')
    .eq('partnership_id', partnershipId)
    .gte('logged_at', range.fromIso)
    .lt('logged_at', range.toIso);
  if (error) throw error;
  return (data ?? []) as Workout[];
};

// How long after `weekEnd` (midnight in the partnership zone) a week must stay
// open. `logged_date` is stamped in the LOGGER's zone, so a partner who is
// behind the partnership zone is still in "Sunday" — and can still log a
// workout that counts for this week — for a few more hours. Closing the week at
// the partnership's midnight would judge them before their day is over.
function graceMsFor(weekEnd: Date, tz: string, zones: Set<string>): number {
  let grace = 0;
  let base: number;
  try {
    base = tzOffsetMs(weekEnd, tz);
  } catch {
    return MAX_ZONE_SPREAD_MS;
  }
  for (const zone of zones) {
    try {
      grace = Math.max(grace, base - tzOffsetMs(weekEnd, zone));
    } catch {
      // Unrecognised zone string: assume the worst case rather than close early.
      return MAX_ZONE_SPREAD_MS;
    }
  }
  return Math.min(grace, MAX_ZONE_SPREAD_MS);
}

// Creates the missing wager-ledger rows for weeks that have fully ended since
// the partnership's `wager_ledger_since` epoch. Idempotent and safe to run from
// both partners' devices: every device reads the same server-side workouts for
// a closed week, so they compute the identical row, and the
// `unique(partnership_id, week_start)` constraint + `ignoreDuplicates` collapse
// the race to a single row.
//
// That claim only holds because `week_start` is derived from the PARTNERSHIP's
// timezone. When it was device-local, partners in different zones produced
// different keys, the unique constraint never fired, and one week could settle
// twice with opposite winners.
//
// Every completed week gets exactly one row, which freezes its outcome:
//   * one partner missed → status 'won', winner = the partner who met the goal
//   * both hit / both missed → status 'wash', no winner
// Without the 'wash' row a no-debt week was re-judged on every run, so raising
// the weekly target or deleting an old workout later could turn a week you
// both passed into a debt.
export async function settleCompletedWeeks({
  partnership,
  anchorHistory,
  userId,
  partnerId,
  tz,
  memberTimezones = [],
  loadWorkouts = fetchPartnershipWorkouts,
  now = new Date(),
}: SettleArgs): Promise<SettleResult> {
  const none: SettleResult = { inserted: 0 };

  if (!partnership || partnership.status !== 'active' || !partnership.paired_at) return none;
  if (!userId || !partnerId) return none;
  const target = partnership.weekly_target ?? 3;
  if (target <= 0) return none;
  if (!partnership.wager_ledger_since) return none;

  const epochMs = new Date(partnership.wager_ledger_since).getTime();
  if (Number.isNaN(epochMs)) return none;
  const nowMs = now.getTime();

  // Week boundaries don't depend on workouts, so find the candidate weeks
  // first and only read workouts for the ones that still need a row.
  const boundaries = bucketWorkoutsByPartnershipWeek([], partnership, anchorHistory, tz, now);
  const ended = boundaries.filter(
    (b) => b.weekEnd.getTime() <= nowMs && b.weekEnd.getTime() > epochMs,
  );
  if (ended.length === 0) return none;

  const keys = ended.map((b) => b.startYmd);
  const { data: existing, error: existingError } = await supabase
    .from('wagers')
    .select('week_start')
    .eq('partnership_id', partnership.id)
    .in('week_start', keys);
  if (existingError) return none;
  const existingSet = new Set((existing ?? []).map((r) => r.week_start as string));
  const missing = ended.filter((b) => !existingSet.has(b.startYmd));
  if (missing.length === 0) return none;

  // Pad the read window by the max zone spread: `logged_date` (the day a
  // workout counts for) can differ from the partnership-zone day of
  // `logged_at` by up to that much.
  const fromMs = Math.min(...missing.map((b) => b.weekStart.getTime())) - MAX_ZONE_SPREAD_MS;
  const toMs = Math.max(...missing.map((b) => b.weekEnd.getTime())) + MAX_ZONE_SPREAD_MS;
  let workouts: Workout[];
  try {
    workouts = await loadWorkouts(partnership.id, {
      fromIso: new Date(fromMs).toISOString(),
      toIso: new Date(toMs).toISOString(),
    });
  } catch {
    return none;
  }

  const zones = new Set<string>();
  for (const z of memberTimezones) if (z) zones.add(z);
  for (const w of workouts) if (w.logged_tz) zones.add(w.logged_tz);

  const mine = workouts.filter((w) => w.partnership_id === partnership.id);
  const byStart = new Map(
    bucketWorkoutsByPartnershipWeek(mine, partnership, anchorHistory, tz, now).map((b) => [
      b.startYmd,
      b,
    ]),
  );

  const terms = formatWager({
    quantity: partnership.wager_quantity,
    text: partnership.wager_text,
    emoji: partnership.wager_emoji,
  });

  const rows: LedgerRow[] = [];
  for (const week of missing) {
    // Still inside some partner's Sunday — leave it for a later pass.
    if (week.weekEnd.getTime() + graceMsFor(week.weekEnd, tz, zones) > nowMs) continue;
    const bucket = byStart.get(week.startYmd);
    const { a: userDays, b: partnerDays } = distinctDaysPerUser(
      bucket?.workouts ?? [],
      userId,
      partnerId,
      tz,
    );
    const userMet = userDays >= target;
    const partnerMet = partnerDays >= target;
    if (userMet === partnerMet) {
      rows.push({
        partnership_id: partnership.id,
        week_start: week.startYmd,
        terms,
        status: 'wash',
        winner_user_id: null,
      });
      continue;
    }
    // The partner who met the goal is owed the stake by the one who missed.
    rows.push({
      partnership_id: partnership.id,
      week_start: week.startYmd,
      terms,
      status: 'won',
      winner_user_id: userMet ? userId : partnerId,
    });
  }

  if (rows.length === 0) return none;

  // ON CONFLICT DO NOTHING — never DO UPDATE. A real upsert would overwrite a
  // week the user already marked `settled` back to `won` and resurrect a paid
  // debt.
  const { error: insertError } = await supabase
    .from('wagers')
    .upsert(rows, { onConflict: 'partnership_id,week_start', ignoreDuplicates: true });
  if (insertError) return none;

  return { inserted: rows.length };
}
