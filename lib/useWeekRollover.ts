import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { Partnership } from '@/types/db';
import {
  getMillisUntilNextRollover,
  getPartnershipWeekStart,
  promoteWeekAnchorIfDue,
} from './week';

type PromotionFields = { week_anchor_at: string; week_anchor_pending_at: null };

// Fires `onRollover` the first time the partnership's week boundary advances
// past the start it was last observed at. Triggers on app foreground and via
// an in-app setTimeout aimed at the next boundary while the app is open.
//
// When a pending week-anchor change is due, `onPromote` is called with the
// field updates to persist. Promotion happens just before the rollover
// notification so callers see consistent state.
//
// Safe to call with a null partnership — the hook simply no-ops until the
// partnership becomes available.
export function useWeekRollover(
  partnership: Partnership | null | undefined,
  onRollover: () => void,
  onPromote?: (fields: PromotionFields) => Promise<void> | void,
) {
  const lastWeekStartRef = useRef<number | null>(null);
  const rolloverRef = useRef(onRollover);
  const promoteRef = useRef(onPromote);
  rolloverRef.current = onRollover;
  promoteRef.current = onPromote;

  useEffect(() => {
    if (!partnership?.paired_at) {
      lastWeekStartRef.current = null;
      return;
    }

    const initialStart = getPartnershipWeekStart(partnership)?.getTime() ?? null;
    if (lastWeekStartRef.current === null) {
      lastWeekStartRef.current = initialStart;
    }

    const check = () => {
      // Promote any due pending anchor before recomputing the week so the new
      // boundaries take effect immediately.
      const promotion = promoteWeekAnchorIfDue(partnership);
      if (promotion && promoteRef.current) {
        void promoteRef.current(promotion);
      }

      const start = getPartnershipWeekStart(partnership)?.getTime() ?? null;
      if (start === null) return;
      const last = lastWeekStartRef.current;
      if (last !== null && start > last) {
        lastWeekStartRef.current = start;
        rolloverRef.current();
      } else if (last === null) {
        lastWeekStartRef.current = start;
      }
    };

    // Cold-start promotion: if the app launches into the foreground with a
    // pending anchor already past, AppState 'active' may not fire — call
    // check() once now to clean up the stale row.
    check();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') check();
    });

    // Aim a timer at the next boundary so rollover fires even while the app
    // sits in the foreground. +500ms buffer to land just past the boundary.
    // The boundary may be either the standard 7-day rollover or an earlier
    // pending-anchor promotion — getMillisUntilNextRollover already accounts
    // for both.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNext = () => {
      const ms = getMillisUntilNextRollover(partnership);
      if (ms === null) return;
      timer = setTimeout(() => {
        check();
        scheduleNext();
      }, ms + 500);
    };
    scheduleNext();

    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [
    partnership?.id,
    partnership?.paired_at,
    partnership?.week_anchor_at,
    partnership?.week_anchor_pending_at,
  ]);
}
