import { useEffect, useRef, useState } from 'react';

import { getPendingInviteBlocked, getPendingInviteCode } from './onboarding';

// Explicit "the pairer has finished with this launch" signal. Inferring it from
// the stashed code being cleared released the hold too early — the code is
// cleared before the partnership refresh and the navigation, so the gate still
// saw an unsubscribed user and flashed the funnel. It also never fired at all
// when redemption failed on a dead connection, so the splash sat for the full
// deadline on every launch.
const settleListeners = new Set<() => void>();

export function notifyPendingPairSettled(): void {
  for (const listener of settleListeners) listener();
}

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

    let released = false;
    const onSettled = () => {
      released = true;
      release();
    };
    settleListeners.add(onSettled);

    void (async () => {
      const [code, blocked] = await Promise.all([
        getPendingInviteCode(),
        getPendingInviteBlocked(),
      ]);
      if (cancelled) return;
      // `released` guards the window where the pairer settled while these two
      // reads were still in flight — holding then would wait out the full
      // deadline with nothing left to wait for.
      if (!code || blocked || released) {
        setHold(false);
        return;
      }
      setHold(true);
      timerRef.current = setTimeout(release, HOLD_MS);
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      settleListeners.delete(onSettled);
    };
  }, []);

  return hold;
}
