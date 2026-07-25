import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import * as widget from 'sweatbuds-widget';
import { getSignedUrls } from './storage';
import { supabase } from './supabase';
import { weekProgressFromWorkouts } from './week';
import type { Partnership, Profile, Workout } from '@/types/db';

const PARTNER_SYNC_KEY = 'widget:lastPartnerWorkoutId';
const PARTNER_SYNC_AT_KEY = 'widget:lastPartnerSyncAt';
const FOREGROUND_DEBOUNCE_MS = 60_000;

export const isWidgetAvailable = Platform.OS === 'ios' && widget.isAvailable;

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
    console.log('[widget] syncWorkoutToWidget skipped: no environment_path on workout', workout.id);
    return;
  }

  const urls = await getSignedUrls([workout.selfie_path, workout.environment_path]);
  const selfieUrl = urls[workout.selfie_path];
  const envUrl = urls[workout.environment_path];
  if (!selfieUrl || !envUrl) {
    console.log('[widget] syncWorkoutToWidget skipped: missing signed URL', { selfieUrl, envUrl });
    return;
  }

  const [selfieUri, environmentUri] = await Promise.all([
    downloadToTemp(selfieUrl, `${source}-selfie`),
    downloadToTemp(envUrl, `${source}-environment`),
  ]);

  console.log('[widget] writing setLatestPost', { source, workoutId: workout.id });
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
    console.log('[widget] syncPartnerLatestToWidget skipped: native module unavailable');
    return;
  }

  if (!args.partner) {
    console.log('[widget] syncPartnerLatestToWidget: no partner → writing noPartner');
    await widget.setEmptyState('noPartner', null);
    await AsyncStorage.removeItem(PARTNER_SYNC_KEY);
    return;
  }

  console.log(
    '[widget] syncPartnerLatestToWidget start',
    { partner: args.partner.display_name, partnerId: args.partner.id, force: !!args.force },
  );

  if (!args.force) {
    const lastSyncAtStr = await AsyncStorage.getItem(PARTNER_SYNC_AT_KEY);
    const lastSyncAt = lastSyncAtStr ? Number(lastSyncAtStr) : 0;
    if (Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < FOREGROUND_DEBOUNCE_MS) {
      console.log('[widget] syncPartnerLatestToWidget debounced');
      return;
    }
  }

  // We previously wrote noLogs eagerly before the fetch to clear any stale
  // noPartner state. That caused a WidgetKit reload race: two reloadTimelines
  // calls within ~1s would silently throttle the second one, leaving the
  // widget stuck on the eager noLogs entry. We now write only one terminal
  // state per sync (ready, noLogs from empty data, or noLogs from fetch error).

  const partnershipId = args.partnership?.id ?? null;
  // Filter strictly by partner's user_id. A partnership_id OR fallback would
  // match every workout in the partnership (including the current user's own),
  // so the most recent log on either device would surface as "the partner's
  // latest" — flipping the widget back to a self-image whenever you out-logged
  // your partner.
  const { data, error } = await supabase
    .from('workouts')
    .select('id, user_id, partnership_id, selfie_path, environment_path, caption, logged_at')
    .eq('user_id', args.partner.id)
    .order('logged_at', { ascending: false })
    .limit(20);

  if (error) {
    console.log('[widget] partner workouts fetch failed:', error.message);
    try {
      await widget.setEmptyState('noLogs', args.partner.display_name);
    } catch (fallbackErr) {
      console.log('[widget] noLogs fallback after fetch error failed:', fallbackErr);
    }
    return;
  }

  console.log('[widget] partner workouts fetched:', data?.length ?? 0);
  await AsyncStorage.setItem(PARTNER_SYNC_AT_KEY, String(Date.now()));

  const partnerWorkouts = (data ?? []) as Workout[];
  const latest = partnerWorkouts[0];
  if (!latest) {
    console.log('[widget] partner has no workouts → writing noLogs');
    await widget.setEmptyState('noLogs', args.partner.display_name);
    await AsyncStorage.removeItem(PARTNER_SYNC_KEY);
    await logZeroResultDiagnostic(args.partner.id, partnershipId);
    return;
  }

  const lastId = await AsyncStorage.getItem(PARTNER_SYNC_KEY);
  if (!args.force && lastId === latest.id) {
    console.log('[widget] partner workout unchanged, skipping');
    return;
  }

  // Match the in-app "this week" counter (distinct logged days this week,
  // Wed-anchored) so the widget chip reads the same as the home screen.
  const streak = weekProgressFromWorkouts(
    partnerWorkouts,
    args.partner,
    args.weeklyTarget,
  ).workoutsThisWeek;

  try {
    await syncWorkoutToWidget({
      workout: latest,
      partnerName: args.partner.display_name,
      streak,
      source: 'partner',
    });
    await AsyncStorage.setItem(PARTNER_SYNC_KEY, latest.id);
    console.log('[widget] syncPartnerLatestToWidget complete: ready');
  } catch (err) {
    console.log('[widget] syncWorkoutToWidget threw, falling back to noLogs:', err);
    try {
      await widget.setEmptyState('noLogs', args.partner.display_name);
    } catch (fallbackErr) {
      console.log('[widget] noLogs fallback also failed:', fallbackErr);
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
  return 'Done — check Metro logs for [widget] entries.';
}

// One-shot diagnostic: when the partner-workouts fetch returns zero rows with
// no error, RLS has silently filtered everything. Surface what the current
// session actually sees so we can tell apart (a) wrong auth.uid, (b) stale
// partnership row, (c) genuinely empty data.
async function logZeroResultDiagnostic(
  partnerId: string,
  partnershipId: string | null,
): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const authUid = userData.user?.id ?? null;
    console.log('[widget][diag] auth.uid()', authUid);

    if (authUid) {
      const { data: partnerships, error: pErr } = await supabase
        .from('partnerships')
        .select('id, user_a, user_b, status, created_at')
        .or(`user_a.eq.${authUid},user_b.eq.${authUid}`)
        .order('created_at', { ascending: false });
      if (pErr) {
        console.log('[widget][diag] partnerships fetch error:', pErr.message);
      } else {
        console.log('[widget][diag] visible partnerships:', JSON.stringify(partnerships ?? []));
      }
    }

    if (partnershipId) {
      const { count, error: cErr } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('partnership_id', partnershipId);
      if (cErr) {
        console.log('[widget][diag] count by partnership_id error:', cErr.message);
      } else {
        console.log('[widget][diag] count by partnership_id:', count ?? 0);
      }
    }

    const { count: byUserCount, error: uErr } = await supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', partnerId);
    if (uErr) {
      console.log('[widget][diag] count by partner user_id error:', uErr.message);
    } else {
      console.log('[widget][diag] count by partner user_id:', byUserCount ?? 0);
    }
  } catch (err) {
    console.log('[widget][diag] threw', err);
  }
}

export async function clearWidget(): Promise<void> {
  if (!isWidgetAvailable) return;
  try {
    await widget.clear();
    await AsyncStorage.multiRemove([PARTNER_SYNC_KEY, PARTNER_SYNC_AT_KEY]);
  } catch (err) {
    if (__DEV__) console.warn('[widget] clear failed', err);
  }
}
