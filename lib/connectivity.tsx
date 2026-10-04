import { useNetworkState } from 'expo-network';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

type ConnectivityContextValue = {
  isOnline: boolean;
};

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

// expo-network reports every field as optional, and they're all undefined until
// the first reading lands. Fail OPEN: only call the device offline once we've
// been explicitly told so, otherwise a cold start would flash an offline banner
// and short-circuit mutations that would have succeeded.
//
// On iOS `isInternetReachable` mirrors `isConnected`; on Android it's the
// stronger signal (connected to a Wi-Fi network with no internet behind it).
//
// TODO(known issue, tabled 2026-10-04): on an iOS cold launch in airplane mode
// the offline banner never appears (docs/qa-regression.md item 6). Toggling
// airplane mode afterwards does show it, so the listener and banner work —
// it's expo-network's launch reading that never lands as offline, and we fail
// open. Tried: also flagging offline when a Supabase fetch throws a network
// error (custom `global.fetch` on the client + a health-endpoint probe to
// clear it). That only showed the banner on some launches, so it was reverted.
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const { isConnected, isInternetReachable } = useNetworkState();

  const isOnline = isConnected !== false && isInternetReachable !== false;

  const value = useMemo<ConnectivityContextValue>(() => ({ isOnline }), [isOnline]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

// Returns true when the device believes it has a working connection. Safe to
// call outside the provider (returns true) so a screen rendered in isolation
// never gates itself off by accident.
export function useIsOnline(): boolean {
  return useContext(ConnectivityContext)?.isOnline ?? true;
}
