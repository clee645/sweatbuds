import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { supabase } from './supabase';
import { syncPartnerLatestToWidget } from './widget';
import type { Partnership, Profile } from '@/types/db';

export const PARTNER_PUSH_TASK = 'PARTNER_PUSH_TASK';

// Runs when iOS delivers a content-available push to a backgrounded or
// terminated app. Foreground delivery is handled by the listener in
// lib/notifications.ts via attachWidgetRefreshOnPush; the two paths together
// cover all three app states.
//
// React context isn't available here (no providers in a headless task), so we
// resolve partnership/partner with direct Supabase queries.
TaskManager.defineTask(PARTNER_PUSH_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[partner-push] task error', error);
    return;
  }
  if (!data) return;

  const payload = data as {
    actionIdentifier?: string;
    notification?: { data?: Record<string, unknown> };
    data?: Record<string, unknown>;
    type?: string;
  };
  // Tap-through delivery is handled by addNotificationResponseReceivedListener.
  if (payload.actionIdentifier) return;

  const inner =
    (payload.notification?.data as { type?: string } | undefined) ??
    (payload.data as { type?: string } | undefined) ??
    payload;
  if (inner?.type !== 'partner_logged') return;

  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult.user?.id;
  if (!userId) return;

  const { data: partnershipRow } = await supabase
    .from('partnerships')
    .select('*')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const partnership = (partnershipRow as Partnership | null) ?? null;
  if (!partnership) return;

  const partnerId =
    partnership.user_a === userId ? partnership.user_b : partnership.user_a;
  if (!partnerId) return;

  const { data: partnerRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle();
  const partner = (partnerRow as Profile | null) ?? null;
  if (!partner) return;

  await syncPartnerLatestToWidget({
    partner,
    partnership,
    weeklyTarget: partnership.weekly_target,
    force: true,
  });
});

Notifications.registerTaskAsync(PARTNER_PUSH_TASK).catch((err) => {
  console.warn('[partner-push] registerTaskAsync failed', err);
});
