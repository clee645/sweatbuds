import { useAuth } from './auth';
import { useDemoUnlocked } from './demoMode';
import { usePartnership } from './partnership';
import { useSubscription } from './subscription';

// DEV ONLY: flip to true to preview the LockedHome screen even on a Pro
// account. No effect in production builds. Remember to set back to false.
const DEV_FORCE_LOCKED = false;

export type AccessGate = {
  // True when the user may use the app: a local App Review demo unlock, their
  // own active subscription, the durable profiles.is_pro bridge (survives
  // reinstall before RevenueCat re-confirms), or an active partner's
  // subscription (one sub covers both).
  unlocked: boolean;
  // True while subscription/partnership state is still resolving. Callers
  // should hold a splash/skeleton rather than flashing the locked screen.
  loading: boolean;
};

// Single source of truth for the subscription gate, used by both the drawer
// layout (routing) and the home screen (content) so they never disagree.
export function useAccessGate(): AccessGate {
  const { profile } = useAuth();
  const { isPro, loading: subscriptionLoading } = useSubscription();
  const { partner, loading: partnershipLoading } = usePartnership();
  const { unlocked: demoUnlocked, loading: demoLoading } = useDemoUnlocked();

  if (__DEV__ && DEV_FORCE_LOCKED) {
    return { unlocked: false, loading: false };
  }

  const unlocked =
    demoUnlocked || isPro || profile?.is_pro === true || partner?.is_pro === true;

  // Once any source says unlocked there is nothing left to wait for, so don't
  // keep reporting `loading` and hold the caller on BrandedSplash. This matters
  // offline: profiles.is_pro is the durable bridge (written server-side by the
  // revenuecat-webhook / sync-subscription, survives reinstall), and it used to
  // be stuck behind a RevenueCat round-trip that can't complete without network.
  if (unlocked) return { unlocked: true, loading: false };

  return {
    unlocked,
    loading: subscriptionLoading || partnershipLoading || demoLoading,
  };
}
