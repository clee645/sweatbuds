import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import * as widget from 'sweatbuds-widget';
import { getSignedUrls } from './storage';
import { supabase } from './supabase';
import {
  getSoloWeekWindow,
  getWeekWindow,
  resolveWeekTimezone,
  weekProgressFromWorkouts,
} from './week';
import type { Partnership, Profile, Workout } from '@/types/db';

const PARTNER_SYNC_KEY = 'widget:lastPartnerWorkoutId';
const PARTNER_SYNC_AT_KEY = 'widget:lastPartnerSyncAt';
const FOREGROUND_DEBOUNCE_MS = 60_000;

export const isWidgetAvailable = Platform.OS === 'ios' && widget.isAvailable;

// Widget sync is chatty and runs on a background task, so its logs would
// otherwise land in the iOS unified log on release builds. Keep them to dev,
// and never pass user identifiers, display names, or signed URLs through here.
function wlog(...args: unknown[]): void {
  if (__DEV__) console.log('[widget]', ...args);
}

async function downloadToTemp(url: string, name: string): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}widget-${name}-${Date.now()}.jpg`;
  const { uri } = await FileSystem.downloadAsync(url, dest);
  return uri;
}

async function syncWorkoutToWidget(args: {
  workout: Workout;
  partnerName: string;
  streak: number;
  source: 'self' | 'partner';
}): Promise<void> {
  if (!isWidgetAvailable) return;
  const { workout, partnerName, streak, source } = args;
  if (!workout.environment_path) {
    wlog('syncWorkoutToWidget skipped: no environment_path on workout');
    return;
  }

  const urls = await getSignedUrls([workout.selfie_path, workout.environment_path]);
  const selfieUrl = urls[workout.selfie_path];
  const envUrl = urls[workout.environment_path];
  if (!selfieUrl || !envUrl) {
    // Log presence only — a signed URL is a bearer credential for a private photo.
    wlog('syncWorkoutToWidget skipped: missing signed URL', {
      hasSelfie: !!selfieUrl,
      hasEnv: !!envUrl,
    });
    return;
  }

  const [selfieUri, environmentUri] = await Promise.all([
    downloadToTemp(selfieUrl, `${source}-selfie`),
    downloadToTemp(envUrl, `${source}-environment`),
  ]);

  wlog('writing setLatestPost', { source });
  await widget.setLatestPost({
    selfieUri,
    environmentUri,
    caption: workout.caption,
    partnerName,
    loggedAt: workout.logged_at,
    streak,
    source,
  });
}

export async function syncPartnerLatestToWidget(args: {
  partner: Profile | null;
  partnership?: Partnership | null;
  weeklyTarget: number;
  force?: boolean;
}): Promise<void> {
  if (!isWidgetAvailable) {
    wlog('syncPartnerLatestToWidget skipped: native module unavailable');
    return;
  }

  if (!args.partner) {
    wlog('syncPartnerLatestToWidget: no partner → writing noPartner');
    await widget.setEmptyState('noPartner', null);
    await AsyncStorage.removeItem(PARTNER_SYNC_KEY);
    return;
  }

  wlog('syncPartnerLatestToWidget start', { force: !!args.force });

  if (!args.force) {
    const lastSyncAtStr = await AsyncStorage.getItem(PARTNER_SYNC_AT_KEY);
    const lastSyncAt = lastSyncAtStr ? Number(lastSyncAtStr) : 0;
    if (Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < FOREGROUND_DEBOUNCE_MS) {
      wlog('syncPartnerLatestToWidget debounced');
      return;
    }
  }

  // We previously wrote noLogs eagerly before the fetch to clear any stale
  // noPartner state. That caused a WidgetKit reload race: two reloadTimelines
  // calls within ~1s would silently throttle the second one, leaving the
  // widget stuck on the eager noLogs entry. We now write only one terminal
  // state per sync (ready, noLogs from empty data, or noLogs from fetch error).

  // Filter strictly by partner's user_id. A partnership_id OR fallback would
  // match every workout in the partnership (including the current user's own),
  // so the most recent log on either device would surface as "the partner's
  // latest" — flipping the widget back to a self-image whenever you out-logged
  // your partner.
  const { data, error } = await supabase
    .from('workouts')
    .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at, logged_date, logged_tz')
    .eq('user_id', args.partner.id)
    .order('logged_at', { ascending: false })
    .limit(20);

  if (error) {
    wlog('partner workouts fetch failed:', error.message);
    try {
      await widget.setEmptyState('noLogs', args.partner.display_name);
    } catch (fallbackErr) {
      wlog('noLogs fallback after fetch error failed:', fallbackErr);
    }
    return;
  }

  wlog('partner workouts fetched:', data?.length ?? 0);
  await AsyncStorage.setItem(PARTNER_SYNC_AT_KEY, String(Date.now()));

  const partnerWorkouts = (data ?? []) as Workout[];
  const latest = partnerWorkouts[0];
  if (!latest) {
    wlog('partner has no workouts → writing noLogs');
    await widget.setEmptyState('noLogs', args.partner.display_name);
    await AsyncStorage.removeItem(PARTNER_SYNC_KEY);
    return;
  }

  const lastId = await AsyncStorage.getItem(PARTNER_SYNC_KEY);
  if (!args.force && lastId === latest.id) {
    wlog('partner workout unchanged, skipping');
    return;
  }

  // Match the in-app "this week" counter (distinct logged days in the couple's
  // current week) so the widget chip reads the same as the home screen.
  //
  // This previously passed no week window at all — and weekProgressFromWorkouts
  // guards its entire loop on `weekStart`, so the chip was hard-zero on every
  // sync. Resolve the real window against the partnership's zone.
  const tz = resolveWeekTimezone(args.partnership);
  const weekWindow =
    getWeekWindow(args.partnership, tz) ?? getSoloWeekWindow(tz);
  const streak = weekProgressFromWorkouts(
    partnerWorkouts,
    args.partner,
    tz,
    args.weeklyTarget,
    weekWindow.weekStart,
    weekWindow.weekEnd,
  ).workoutsThisWeek;

  try {
    await syncWorkoutToWidget({
      workout: latest,
      partnerName: args.partner.display_name,
      streak,
      source: 'partner',
    });
    await AsyncStorage.setItem(PARTNER_SYNC_KEY, latest.id);
    wlog('syncPartnerLatestToWidget complete: ready');
  } catch (err) {
    wlog('syncWorkoutToWidget threw, falling back to noLogs:', err);
    try {
      await widget.setEmptyState('noLogs', args.partner.display_name);
    } catch (fallbackErr) {
      wlog('noLogs fallback also failed:', fallbackErr);
    }
  }
}

// Diagnostic: force a fresh sync and return a short status string. Used by a
// debug button in settings.
export async function debugForcePartnerSync(args: {
  partner: Profile | null;
  partnership?: Partnership | null;
  weeklyTarget: number;
}): Promise<string> {
  if (!isWidgetAvailable) return 'Native widget module unavailable on this build.';
  if (!args.partner) return 'No partner — wrote noPartner state.';
  await AsyncStorage.removeItem(PARTNER_SYNC_KEY);
  await AsyncStorage.removeItem(PARTNER_SYNC_AT_KEY);
  await syncPartnerLatestToWidget({ ...args, force: true });
  return 'Done — widget refreshed.';
}

export async function clearWidget(): Promise<void> {
  if (!isWidgetAvailable) return;
  try {
    await widget.clear();
    await AsyncStorage.multiRemove([PARTNER_SYNC_KEY, PARTNER_SYNC_AT_KEY]);
  } catch (err) {
    wlog('clear failed', err);
  }
}
