import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// App Review demo bypass.
//
// Sweatbuds is gated behind a subscription (or an active partner's), but Apple
// reviewers need to see the full app without completing a sandbox purchase
// (which is flaky for reviewers and can't be shared across the two-partner
// flow). So we let a reserved code unlock the app locally.
//
// This is deliberately a CLIENT-SIDE, local-only unlock — it does NOT grant a
// RevenueCat entitlement or touch the database. That keeps it isolated from
// real subscription state and impossible to abuse for partner pairing
// (redeem_invite_code still requires a real is_pro). It only flips the home
// gate for this device. Promo codes, by contrast, go through RevenueCat and
// grant a genuine entitlement — see lib/promo.ts.
//
// Set EXPO_PUBLIC_DEMO_ACCESS_CODE to enable; leave it unset in builds where
// you don't want a bypass to exist at all. Document the active code in the
// App Review notes.

const STORAGE_KEY = 'demo_unlocked';
const DEMO_CODE = process.env.EXPO_PUBLIC_DEMO_ACCESS_CODE?.trim().toUpperCase() || null;

let cache = false;
let hydrated = false;
const listeners = new Set<(value: boolean) => void>();

function emit() {
  for (const listener of listeners) listener(cache);
}

async function hydrate(): Promise<void> {
  try {
    cache = (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    cache = false;
  }
  hydrated = true;
  emit();
}

/** True when the entered code matches the configured reviewer code. */
export function matchesDemoCode(code: string): boolean {
  if (!DEMO_CODE) return false;
  return code.trim().toUpperCase() === DEMO_CODE;
}

/** Persist the local demo unlock and notify subscribers (the access gate). */
export async function setDemoUnlocked(value: boolean): Promise<void> {
  cache = value;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Best effort — the in-memory value still unlocks this session.
  }
  emit();
}

/**
 * Subscribe to the local demo-unlock flag. `loading` is true until the first
 * AsyncStorage read resolves so the gate can hold a splash rather than flash
 * the locked screen for a reviewer who already unlocked.
 */
export function useDemoUnlocked(): { unlocked: boolean; loading: boolean } {
  const [unlocked, setUnlocked] = useState(cache);
  const [loading, setLoading] = useState(!hydrated);

  useEffect(() => {
    const listener = (value: boolean) => {
      setUnlocked(value);
      setLoading(false);
    };
    listeners.add(listener);
    if (hydrated) {
      setUnlocked(cache);
      setLoading(false);
    } else {
      void hydrate();
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { unlocked, loading };
}
