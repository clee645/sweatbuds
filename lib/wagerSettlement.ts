import type { Partnership, PartnershipAnchorHistory, Workout } from '@/types/db';

import {
  bucketWorkoutsByPartnershipWeek,
  distinctDaysPerUser,
} from './historyWeek';
import { supabase } from './supabase';
import { formatWager } from './wagers';

type SettleArgs = {
  partnership: Partnership | null | undefined;
  anchorHistory: PartnershipAnchorHistory[] | null | undefined;
  workouts: Workout[];
  userId: string | null | undefined;
  partnerId: string | null | undefined;
  // The partnership's canonical zone. Both devices MUST pass the same value —
  // it determines `week_start`, which is the ledger's dedupe key.
  tz: string;
  now?: Date;
};

export type SettleResult = { inserted: number };

// Creates the missing wager-ledger rows for weeks that have fully ended since
// the partnership's `wager_ledger_since` epoch. Idempotent and safe to run from
// both partners' devices: past-week workouts are frozen (workouts can't be
// backdated), so every device computes the identical row, and the
// `unique(partnership_id, week_start)` constraint + `ignoreDuplicates` collapse
// the race to a single row.
//
// That claim only holds because `week_start` is derived from the PARTNERSHIP's
// timezone. When it was device-local, partners in different zones produced
// different keys, the unique constraint never fired, and one week could settle
// twice with opposite winners.
//
// A row is written ONLY when exactly one partner missed the weekly goal — the
// partner who met it is recorded as `winner_user_id` (they are owed) and the
// misser owes the stake. Both-hit and both-missed weeks produce no row (a wash).
export async function settleCompletedWeeks({
  partnership,
  anchorHistory,
  workouts,
  userId,
  partnerId,
  tz,
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

  // Only consider this partnership's shared workouts (belt-and-suspenders;
  // bucketing already drops pre-pair rows via paired_at).
  const mine = workouts.filter((w) => w.partnership_id === partnership.id);
  const buckets = bucketWorkoutsByPartnershipWeek(mine, partnership, anchorHistory, tz, now);

  // Completed weeks whose end lands strictly after the ledger epoch. `weekEnd`
  // is exclusive local-midnight of the day after the bucket's last day.
  const eligible = buckets.filter(
    (b) => b.weekEnd.getTime() <= nowMs && b.weekEnd.getTime() > epochMs,
  );
  if (eligible.length === 0) return none;

  const keys = eligible.map((b) => b.startYmd);
  const { data: existing, error: existingError } = await supabase
    .from('wagers')
    .select('week_start')
    .eq('partnership_id', partnership.id)
    .in('week_start', keys);
  if (existingError) return none;
  const existingSet = new Set((existing ?? []).map((r) => r.week_start as string));

  const terms = formatWager({
    quantity: partnership.wager_quantity,
    text: partnership.wager_text,
    emoji: partnership.wager_emoji,
  });

  const rows: {
    partnership_id: string;
    week_start: string;
    terms: string;
    status: 'won';
    winner_user_id: string;
  }[] = [];

  for (const b of eligible) {
    const key = b.startYmd;
    if (existingSet.has(key)) continue;
    const { a: userDays, b: partnerDays } = distinctDaysPerUser(
      b.workouts,
      userId,
      partnerId,
      tz,
    );
    const userMet = userDays >= target;
    const partnerMet = partnerDays >= target;
    // Both hit or both missed → nobody owes; no ledger row.
    if (userMet === partnerMet) continue;
    // The partner who met the goal is owed the stake by the one who missed.
    const winner = userMet ? userId : partnerId;
    rows.push({
      partnership_id: partnership.id,
      week_start: key,
      terms,
      status: 'won',
      winner_user_id: winner,
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
