import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth';
import { generateInviteCode } from '@/lib/invite';
import {
  clearMyPendingInviteCode,
  getMyPendingInviteCode,
  getPendingWager,
  getPendingWorkoutDays,
} from '@/lib/onboarding';
import { usePartnership } from '@/lib/partnership';
import { supabase } from '@/lib/supabase';

// Persists the user's onboarding choices (weekly plan, wager, and any invite
// code they generated) into a `partnerships` row once they sign up, so their
// configured weekly rules survive into the account. Renders nothing; runs once
// per mount.
export function PendingInviteRegistrar() {
  const { user } = useAuth();
  const { refresh } = usePartnership();
  const attempted = useRef(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    (async () => {
      // Skip if this user is already part of a partnership (e.g. they redeemed
      // a partner's code during onboarding — those rules belong to the inviter,
      // so we must not overwrite them with this user's picks).
      const { data: existing } = await supabase
        .from('partnerships')
        .select('id')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (existing) {
        await clearMyPendingInviteCode();
        return;
      }

      // Apply the weekly plan + wager picked during onboarding. We create the
      // partnership row regardless of whether the user generated an invite code
      // — every new account needs its configured weekly rules persisted, even
      // for users who skip inviting a partner or who never pay. Without this,
      // the row is missing and the home/hamburger fall back to defaults.
      const days = await getPendingWorkoutDays();
      const wager = await getPendingWager();
      const pendingCode = await getMyPendingInviteCode();
      if (cancelled) return;

      // Nothing to register: no onboarding selections and no invite code (e.g.
      // a re-login on a device where the stash was already consumed/cleared).
      if (days == null && !wager && !pendingCode) return;

      const base: Record<string, unknown> = { user_a: userId };
      if (days != null) base.weekly_target = days;
      if (wager) {
        base.wager_quantity = wager.quantity;
        base.wager_text = wager.label;
        base.wager_emoji = wager.emoji;
      }

      // Use the code generated during onboarding if present; otherwise mint a
      // fresh one so the row (and the user's shareable invite) still exists.
      const code = pendingCode ?? generateInviteCode();

      // Insert with the chosen code; on the (astronomically rare) unique
      // collision, fall back to a fresh code.
      let { error } = await supabase
        .from('partnerships')
        .insert({ ...base, invite_code: code });
      if (error && error.code === '23505') {
        ({ error } = await supabase
          .from('partnerships')
          .insert({ ...base, invite_code: generateInviteCode() }));
      }
      if (cancelled) return;
      if (error) {
        Alert.alert(
          'Setup issue',
          'We could not finish setting up your partnership. You can invite your partner from the Partner screen.',
        );
        return;
      }
      await clearMyPendingInviteCode();
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, refresh]);

  return null;
}
