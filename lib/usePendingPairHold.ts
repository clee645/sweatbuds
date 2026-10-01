import { useEffect, useRef, useState } from 'react';

import {
  getPendingInviteBlocked,
  getPendingInviteCode,
  subscribePendingInviteBlocked,
  subscribePendingInviteCode,
} from './onboarding';

// How long the splash may be held waiting for PendingInvitePairer to settle.
// Generous enough for waitForProfileReady (8s cap) plus the redeem round trip,
// bounded so a hung network can never strand the user on the splash.
const HOLD_MS = 10_000;

// True while a freshly signed-up invitee still has an unredeemed invite code.
//
// Without it the drawer gate wins the race every time — it needs one partnership
// fetch, while the pairer waits on the profile barrier, the redeem RPC and a
// partnership refresh — so an invitee whose partner already pays was shown the
// subscription funnel for a second before join-confirm covered it. Fast tappers
// could get far enough to buy a second subscription their partner already
// covers.
//
// The hold drops as soon as pairing succeeds (the code is cleared), as soon as
// it's refused for want of a subscription (the funnel is then the right place
// to send them), or when the deadline passes.
export function usePendingPairHold(): boolean {
  const [hold, setHold] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const release = () => {
      if (cancelled) return;
      setHold(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    void (async () => {
      const [code, blocked] = await Promise.all([
        getPendingInviteCode(),
        getPendingInviteBlocked(),
      ]);
      if (cancelled) return;
      if (!code || blocked) {
        setHold(false);
        return;
      }
      setHold(true);
      timerRef.current = setTimeout(release, HOLD_MS);
    })();

    const unsubCode = subscribePendingInviteCode((code) => {
      if (!code) release();
    });
    const unsubBlocked = subscribePendingInviteBlocked((blocked) => {
      if (blocked) release();
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      unsubCode();
      unsubBlocked();
    };
  }, []);

  return hold;
}
