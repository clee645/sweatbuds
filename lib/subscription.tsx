import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesOffering,
} from 'react-native-purchases';

import { useAuth } from './auth';
import {
  getCurrentOffering,
  getCustomerInfo,
  hasProEntitlement,
  isRevenueCatConfigured,
} from './revenuecat';
import { supabase } from './supabase';

type SubscriptionContextValue = {
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  isPro: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  // SubscriptionProvider is nested inside AuthProvider, so the signed-in user
  // is available here — used to reconcile the durable profiles.is_pro /
  // is_pro_until flags the home gate reads.
  const { user, refreshProfile } = useAuth();
  const userId = user?.id ?? null;

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Last isPro value we asked the server to reconcile for the current user, so
  // we sync once per resolved state rather than on every customerInfo tick.
  const lastSyncedRef = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      setLoading(false);
      return;
    }
    const [info, current] = await Promise.all([getCustomerInfo(), getCurrentOffering()]);
    if (!mountedRef.current) return;
    setCustomerInfo(info);
    setOffering(current);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const listener: CustomerInfoUpdateListener = (info) => {
      if (!mountedRef.current) return;
      setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mountedRef.current = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refresh]);

  // Re-pull customer info once the authenticated user is known. auth.tsx
  // dispatches Purchases.logIn(userId) on the same change; this ensures the
  // gate reflects the logged-in RC user rather than the anonymous one, even if
  // the update listener is slow to fire. Also resets the per-user sync cache.
  useEffect(() => {
    lastSyncedRef.current = null;
    if (!userId) return;
    void refresh();
  }, [userId, refresh]);

  const isPro = hasProEntitlement(customerInfo);

  // Ask the server to reconcile profiles.is_pro / is_pro_until from RevenueCat's
  // authoritative state. The revenuecat-webhook is the primary source of truth;
  // this is the belt-and-suspenders path that (a) reconciles on launch in case a
  // webhook was missed, (b) covers a purchase made before login, and (c) makes a
  // partner's unlock track quickly without waiting on webhook delivery. We never
  // write is_pro from the client anymore — the server fetches from RevenueCat so
  // a tampered client can't grant itself Pro.
  useEffect(() => {
    if (!isRevenueCatConfigured()) return;
    if (loading || !userId) return;
    if (lastSyncedRef.current === isPro) return;

    lastSyncedRef.current = isPro;
    void (async () => {
      const { error } = await supabase.functions.invoke('sync-subscription');
      if (error) {
        // Let the next tick retry rather than leaving the durable flag stale.
        lastSyncedRef.current = null;
        if (__DEV__) console.warn('[subscription] sync-subscription failed', error);
        return;
      }
      // Pull the freshly-written flags so the gate's profile.is_pro bridge is
      // current on the next render and launch.
      await refreshProfile().catch(() => undefined);
    })();
  }, [isPro, loading, userId, refreshProfile]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      customerInfo,
      offering,
      isPro,
      loading,
      refresh,
    }),
    [customerInfo, offering, isPro, loading, refresh],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
