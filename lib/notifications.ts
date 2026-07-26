import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { syncPartnerLatestToWidget } from './widget';
import type { Partnership, Profile } from '@/types/db';

let receivedSubscription: { remove: () => void } | null = null;
let backgroundSubscription: { remove: () => void } | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted && settings.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted = req.granted;
  }

  if (!granted) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    console.error('[notifications] missing EAS projectId — run `eas init`');
    return;
  }

  let token: string | null = null;
  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenResult.data ?? null;
  } catch (err) {
    // Simulator/web throw "must be on a physical device" — expected.
    // Anything else is a real config bug worth surfacing.
    console.warn('[notifications] getExpoPushTokenAsync failed', err);
    return;
  }
  if (!token) return;

  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  await supabase
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
}

export async function unregisterPushToken(userId: string): Promise<void> {
  await supabase.from('device_tokens').delete().eq('user_id', userId);
}

type PartnerLoggedData = {
  type: 'partner_logged';
  workout_id: string;
};

type PartnerPairedData = {
  type: 'partner_paired';
  partnership_id: string;
};

type PartnerCommentedData = {
  type: 'partner_commented';
  workout_id: string;
  comment_id: string;
};

type PartnerLeftData = {
  type: 'partner_left';
};

type PartnerPushData =
  | PartnerLoggedData
  | PartnerPairedData
  | PartnerCommentedData
  | PartnerLeftData;

function partnerPushType(data: unknown): PartnerPushData['type'] | null {
  if (typeof data !== 'object' || data === null) return null;
  const t = (data as { type?: unknown }).type;
  if (
    t === 'partner_logged' ||
    t === 'partner_paired' ||
    t === 'partner_commented' ||
    t === 'partner_left'
  ) {
    return t;
  }
  return null;
}

function workoutIdFromData(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const v = (data as { workout_id?: unknown }).workout_id;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

// Wires push receipt to widget + workouts + history + partnership + comments
// refresh. Handles three push kinds:
//   - partner_logged:    a workout went up; refresh widget + carousel + history.
//     (history is deliberately NOT refreshed on partner_commented — a comment
//     can't change the workout set, and history's query is unbounded all-time.)
//   - partner_paired:    status flipped to active; refresh partnership FIRST
//                        so the partner profile resolves locally, then sync.
//   - partner_commented: partner left a comment; refresh comments. On tap,
//                        deep-link to the photo detail screen.
export function attachWidgetRefreshOnPush(getCurrent: () => {
  partner: Profile | null;
  partnership: Partnership | null;
  weeklyTarget: number;
  refreshWorkouts: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshPartnership: () => Promise<void>;
  refreshComments: () => Promise<void>;
}): () => void {
  receivedSubscription?.remove();
  backgroundSubscription?.remove();

  const handler = async (notification: Notifications.Notification) => {
    const data = notification.request.content.data;
    const kind = partnerPushType(data);
    if (!kind) return;

    if (kind === 'partner_paired') {
      const { refreshPartnership } = getCurrent();
      await refreshPartnership();
    }

    if (kind === 'partner_left') {
      // Partnership is gone; drop local state to solo. The PartnershipProvider's
      // refresh() detects the active->none transition and shows the toast.
      const { refreshPartnership, refreshWorkouts, refreshHistory } = getCurrent();
      await refreshPartnership();
      await Promise.all([refreshWorkouts(), refreshHistory()]);
      return;
    }

    const {
      partner,
      partnership,
      weeklyTarget,
      refreshWorkouts,
      refreshHistory,
      refreshComments,
    } = getCurrent();

    if (kind === 'partner_commented') {
      await Promise.all([refreshWorkouts(), refreshComments()]);
      return;
    }

    await Promise.all([
      syncPartnerLatestToWidget({ partner, partnership, weeklyTarget, force: true }),
      refreshWorkouts(),
      refreshHistory(),
    ]);
  };

  receivedSubscription = Notifications.addNotificationReceivedListener(handler);
  // Tap-through still triggers a refresh in case the silent push was throttled,
  // and deep-links the user to the relevant workout for comment notifications.
  backgroundSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      const kind = partnerPushType(data);
      if (kind === 'partner_commented' || kind === 'partner_logged') {
        const wid = workoutIdFromData(data);
        if (wid) {
          try {
            router.push(`/photo/${wid}`);
          } catch {
            // Router may not be ready on cold start — the refresh below still
            // runs so the comment shows when the user navigates manually.
          }
        }
      }
      void handler(response.notification);
    },
  );

  return () => {
    receivedSubscription?.remove();
    backgroundSubscription?.remove();
    receivedSubscription = null;
    backgroundSubscription = null;
  };
}
