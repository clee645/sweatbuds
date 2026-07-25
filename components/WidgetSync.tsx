import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useWorkoutComments } from '@/lib/comments';
import { attachWidgetRefreshOnPush } from '@/lib/notifications';
import { usePartnership } from '@/lib/partnership';
import { syncPartnerLatestToWidget } from '@/lib/widget';
import { useWorkouts } from '@/lib/workouts';

// Mounted once at the root, after the auth/partnership/workouts providers.
// Drives partner-latest widget refreshes:
//   - whenever the partner profile resolves or changes
//   - on each app foreground (debounced inside lib/widget.ts)
// Self-log writes happen inline at the log-success site.
export function WidgetSync() {
  const { user } = useAuth();
  const {
    partnership,
    partner,
    loading: partnershipLoading,
    refresh: refreshPartnership,
  } = usePartnership();
  const { refresh: refreshWorkouts } = useWorkouts();
  const { refresh: refreshComments } = useWorkoutComments();
  const lastPartnerIdRef = useRef<string | null>(null);
  const hasWrittenInitialRef = useRef(false);

  const partnerId = partner?.id ?? null;
  const weeklyTarget = partnership?.weekly_target ?? 3;

  // Wait until partnership has finished loading before writing anything to
  // the App Group. Otherwise the first render sees `partner: null` (because
  // partnership is still mid-fetch) and prematurely stamps the widget with
  // the "Pair up" empty state, even when the user IS paired — that stale
  // state can outlive the next refresh if the widget reads it first.
  useEffect(() => {
    if (!user) return;
    if (partnershipLoading) return;
    if (
      hasWrittenInitialRef.current &&
      lastPartnerIdRef.current === partnerId &&
      partnerId !== null
    ) {
      return;
    }
    lastPartnerIdRef.current = partnerId;
    hasWrittenInitialRef.current = true;
    void syncPartnerLatestToWidget({ partner, partnership, weeklyTarget, force: true });
  }, [user, partner, partnership, partnerId, weeklyTarget, partnershipLoading]);

  useEffect(() => {
    if (!user) return;
    const handler = (state: AppStateStatus) => {
      if (state !== 'active') return;
      void refreshPartnership();
      // Only sync the widget on foreground if we actually know the partner
      // state — same reason as above. The post-pairing-resolve effect will
      // pick this up once refreshPartnership completes.
      if (!partnershipLoading) {
        void syncPartnerLatestToWidget({ partner, partnership, weeklyTarget });
      }
      void refreshWorkouts();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [
    user,
    partner,
    partnership,
    weeklyTarget,
    refreshWorkouts,
    refreshPartnership,
    partnershipLoading,
  ]);

  // Push receive → widget + workouts + partnership + comments refresh. The
  // closure captures the latest values via the ref so we don't have to
  // detach/reattach on every change.
  const partnerRef = useRef({
    partner,
    partnership,
    weeklyTarget,
    refreshWorkouts,
    refreshPartnership,
    refreshComments,
  });
  partnerRef.current = {
    partner,
    partnership,
    weeklyTarget,
    refreshWorkouts,
    refreshPartnership,
    refreshComments,
  };
  useEffect(() => {
    if (!user) return;
    const detach = attachWidgetRefreshOnPush(() => partnerRef.current);
    return detach;
  }, [user]);

  return null;
}
