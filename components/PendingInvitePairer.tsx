import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/lib/auth';
import { isNetworkError, toUserMessage } from '@/lib/errors';
import { pairWithCode } from '@/lib/invite';
import { clearPendingInviteCode, getPendingInviteCode } from '@/lib/onboarding';
import { usePartnership } from '@/lib/partnership';
import { waitForProfileReady } from '@/lib/profileReady';
import { supabase } from '@/lib/supabase';

// Redeems an invite code that was entered during onboarding (before sign-in).
// Pairing needs a Supabase session, so the invite-code screen stashes the code
// and this component redeems it once the user is authenticated. Runs at most
// once per mount; renders nothing.
export function PendingInvitePairer() {
  const { user } = useAuth();
  const { refresh } = usePartnership();
  const attempted = useRef(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    (async () => {
      const code = await getPendingInviteCode();
      if (cancelled || !code) return;

      // Let the joiner's onboarding name land on their profile first. Redeeming
      // the code fires a realtime event on the inviter's device, which snapshots
      // the partner's display_name for a one-shot celebration — pair too early
      // and that celebration is stuck with the OAuth-seeded name.
      await waitForProfileReady(userId);
      if (cancelled) return;

      try {
        const updated = await pairWithCode(code);
        await clearPendingInviteCode();
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
        if (cancelled) return;
        // Send the invitee to review & sign the shared terms their partner set;
        // join-confirm hands off to the pairing celebration once they agree.
        router.push({
          pathname: '/join-confirm',
          params: partnerName ? { name: partnerName } : undefined,
        });
      } catch (e) {
        // The stashed code is single-use, so a *server* rejection means it can
        // never succeed — drop it rather than retry-loop. A network failure is
        // different: the code was never consumed, and clearing it here used to
        // permanently lose the invite on a flaky first launch, forcing the user
        // to re-enter it by hand. Keep it and let the next mount retry.
        if (!isNetworkError(e)) {
          await clearPendingInviteCode();
        }
        Alert.alert('Could not connect with partner', toUserMessage(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, refresh]);

  return null;
}
