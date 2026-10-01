import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { isNetworkError, toUserMessage } from '@/lib/errors';
import { captureException } from '@/lib/reporting';
import { pairWithCode, SubscriptionRequiredError } from '@/lib/invite';
import {
  clearPendingInviteCode,
  getPendingInviteCode,
  setPaywallSeen,
  setPendingInviteBlocked,
} from '@/lib/onboarding';
import { usePartnership } from '@/lib/partnership';
import { waitForProfileReady } from '@/lib/profileReady';
import { supabase } from '@/lib/supabase';

// Redeems an invite code that was entered during onboarding (before sign-in).
// Pairing needs a Supabase session, so the invite-code screen stashes the code
// and this component redeems it once the user is authenticated.
//
// Retries matter as much as the first attempt: the two reasons pairing fails
// here are both temporary. "Neither of you has subscribed" clears when EITHER
// side pays — and when the INVITER is the one who pays, nothing on this device
// changes (no partnership row yet, so no realtime channel to hear it on), so
// only a foreground retry reconnects them. A network failure is likewise worth
// retrying. Renders nothing.
export function PendingInvitePairer() {
  const { user, profile } = useAuth();
  const { refresh } = usePartnership();
  // profiles.is_pro, not RevenueCat's isPro: it's the flag redeem_invite_code
  // checks, so retrying on it can't race the server-side subscription sync.
  const isPro = profile?.is_pro === true;
  const userId = user?.id ?? null;
  // Guards against two passes overlapping (foreground while one is in flight),
  // not against retrying — a settled failed attempt leaves this false.
  const runningRef = useRef(false);

  const attempt = useCallback(async () => {
    if (!userId || runningRef.current) return;
    const code = await getPendingInviteCode();
    if (!code) return;
    runningRef.current = true;
    try {
      // Let the joiner's onboarding name land on their profile first. Redeeming
      // the code fires a realtime event on the inviter's device, which snapshots
      // the partner's display_name for a one-shot celebration — pair too early
      // and that celebration is stuck with the OAuth-seeded name.
      await waitForProfileReady(userId);

      try {
        const updated = await pairWithCode(code);
        await clearPendingInviteCode();
        await setPendingInviteBlocked(false);
        // Their partner's subscription covers them, so the funnel is done with
        // for good. Without this, any later launch that can't resolve the
        // partnership (offline cold start) drops them back into the paywall.
        await setPaywallSeen();
        await refresh();

        // Resolve the partner's name for the celebration screen.
        const otherId = updated.user_a === userId ? updated.user_b : updated.user_a;
        let partnerName: string | null = null;
        if (otherId) {
          const { data } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', otherId)
            .maybeSingle();
          partnerName = (data as { display_name?: string } | null)?.display_name ?? null;
        }
        // Send the invitee to review & sign the shared terms their partner set;
        // join-confirm hands off to the pairing celebration once they agree.
        router.push({
          pathname: '/join-confirm',
          params: partnerName ? { name: partnerName } : undefined,
        });
      } catch (e) {
        // Neither side has paid yet. Keep the code and record that we're waiting
        // so LockedHome can say so — silently dropping the user into the generic
        // "invite your partner" copy is what made this look broken.
        if (e instanceof SubscriptionRequiredError) {
          await setPendingInviteBlocked(true);
          return;
        }

        // The stashed code is single-use, so any other *server* rejection
        // means it can never succeed — drop it rather than retry-loop. A
        // network failure is different: the code was never consumed, and
        // clearing it here used to permanently lose the invite on a flaky
        // first launch, forcing the user to re-enter it by hand. Keep it and
        // retry on the next foreground.
        if (!isNetworkError(e)) {
          await clearPendingInviteCode();
          await setPendingInviteBlocked(false);
          captureException(e, { operation: 'pending_invite_pair' });
          Alert.alert('Could not connect with partner', toUserMessage(e));
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [userId, refresh]);

  // Sign-in, and again whenever this user's own subscription lands.
  useEffect(() => {
    void attempt();
  }, [attempt, isPro]);

  // Foreground: the only signal this device gets when the INVITER subscribes,
  // and the retry for a failed first launch.
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void attempt();
    });
    return () => sub.remove();
  }, [attempt, userId]);

  return null;
}
