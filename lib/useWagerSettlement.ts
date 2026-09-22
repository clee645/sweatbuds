import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from './auth';
import { useHistoryWorkouts } from './history';
import { usePartnership } from './partnership';
import { settleCompletedWeeks } from './wagerSettlement';
import { getMillisUntilNextRollover } from './week';
import { deviceTimezone } from './zonedTime';

// Runs the wager-ledger settlement pass in the background so completed weeks get
// resolved into the `wagers` table without any user action. Fires on mount, on
// app foreground, whenever the all-time workout set refreshes (foreground/pair
// change), and via a timer aimed at the next week boundary while the app stays
// open. Idempotent — see `settleCompletedWeeks`.
//
// The history list is only a re-run SIGNAL here: settlement reads the week's
// workouts from the server itself, so a half-loaded or stale list can never
// decide a week. Meant to be mounted once at the
// app root (see `components/WagerSettlementRunner.tsx`).
export function useWagerSettlement() {
  const { user, profile } = useAuth();
  const { partnership, partner, anchorHistory, weekTimezone } = usePartnership();
  const { workouts } = useHistoryWorkouts();

  const userId = user?.id ?? null;
  const partnerId = partner?.id ?? null;

  // Keep the latest inputs in a ref so the run function is stable and the
  // boundary timer / AppState listener always see current data.
  const memberTimezones = [profile?.timezone, partner?.timezone];
  const argsRef = useRef({ partnership, anchorHistory, userId, partnerId, weekTimezone, memberTimezones });
  argsRef.current = { partnership, anchorHistory, userId, partnerId, weekTimezone, memberTimezones };

  const runningRef = useRef(false);

  const run = useRef(async () => {
    if (runningRef.current) return;
    const {
      partnership: p,
      anchorHistory: ah,
      userId: uid,
      partnerId: pid,
      weekTimezone: tz,
      memberTimezones: zones,
    } = argsRef.current;
    if (!p || p.status !== 'active' || !uid || !pid) return;
    runningRef.current = true;
    try {
      await settleCompletedWeeks({
        partnership: p,
        anchorHistory: ah,
        userId: uid,
        partnerId: pid,
        tz,
        // This device's zone too: the user's own workouts are stamped with it.
        memberTimezones: [...zones, deviceTimezone()],
      });
    } catch {
      // Best-effort; a failed pass simply retries on the next trigger.
    } finally {
      runningRef.current = false;
    }
  }).current;

  // Re-run whenever the inputs that affect the outcome change: the workout set
  // (loads/refreshes async), the partnership identity/boundaries, or the ledger
  // epoch. Cheap and idempotent when there's nothing new to settle.
  useEffect(() => {
    void run();
  }, [
    run,
    workouts,
    partnership?.id,
    partnership?.paired_at,
    partnership?.week_anchor_at,
    partnership?.week_anchor_pending_at,
    partnership?.wager_ledger_since,
    userId,
    partnerId,
  ]);

  // Foreground + next-boundary timer, so settlement also fires when the app
  // sits open across a week rollover (no data refresh would otherwise trigger).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void run();
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNext = () => {
      const ms = getMillisUntilNextRollover(
        argsRef.current.partnership,
        argsRef.current.weekTimezone,
      );
      if (ms === null) return;
      timer = setTimeout(() => {
        void run();
        scheduleNext();
      }, ms + 1000);
    };
    scheduleNext();

    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [run, partnership?.id, partnership?.week_anchor_at, partnership?.week_anchor_pending_at]);
}
