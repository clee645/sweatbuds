import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { generateInviteCode } from './invite';

// First-launch flag: once the user has been through (or skipped) the
// onboarding flow, we never auto-show it again.
const ONBOARDING_SEEN_KEY = 'sweatbuds:onboardingSeen';

export async function getOnboardingSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === 'true';
  } catch {
    // Storage unavailable — treat as seen so we don't trap the user in
    // onboarding on every launch.
    return true;
  }
}

export async function setOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
  } catch {
    // Best-effort; a failed write just means onboarding may show again.
  }
}

// Cleared on account deletion so a re-signup with the same identity starts fresh.
// A normal sign-out intentionally does NOT clear this.
export async function clearOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY);
  } catch {
    // Best-effort.
  }
}

// Post-signup paywall flag: once the user has been through (or skipped) the
// paywall flow, we never auto-show it again.
// TODO: replace with a real RevenueCat subscription-status check when billing
// is wired up.
const PAYWALL_SEEN_KEY = 'sweatbuds:paywallSeen';

// Dev-only: forget the paywall flag once per app launch so the paywall flow can
// be re-tested every run. No effect on production builds.
let devPaywallResetDone = false;

export async function getPaywallSeen(): Promise<boolean> {
  try {
    if (__DEV__ && !devPaywallResetDone) {
      devPaywallResetDone = true;
      await AsyncStorage.removeItem(PAYWALL_SEEN_KEY);
      return false;
    }
    return (await AsyncStorage.getItem(PAYWALL_SEEN_KEY)) === 'true';
  } catch {
    // Storage unavailable — treat as seen so we don't trap the user in the
    // paywall flow on every launch.
    return true;
  }
}

export async function setPaywallSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PAYWALL_SEEN_KEY, 'true');
  } catch {
    // Best-effort; a failed write just means the paywall may show again.
  }
}

// Cleared on account deletion so a re-signup with the same identity starts fresh.
// A normal sign-out intentionally does NOT clear this.
export async function clearPaywallSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PAYWALL_SEEN_KEY);
  } catch {
    // Best-effort.
  }
}

// Post-purchase widget walkthrough flag: once the user has clicked (or skipped)
// through the widget setup screens, we never auto-show them again. The widget
// itself can't be probed — this records that we showed the walkthrough, not that
// the widget was actually added.
const WIDGET_SETUP_SEEN_KEY = 'sweatbuds:widgetSetupSeen';

export async function getWidgetSetupSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WIDGET_SETUP_SEEN_KEY)) === 'true';
  } catch {
    // Storage unavailable — treat as seen so we don't trap the user in the
    // walkthrough on every launch.
    return true;
  }
}

export async function setWidgetSetupSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_SETUP_SEEN_KEY, 'true');
  } catch {
    // Best-effort; a failed write just means the walkthrough may show again.
  }
}

// Cleared on account deletion so a re-signup with the same identity starts fresh.
export async function clearWidgetSetupSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WIDGET_SETUP_SEEN_KEY);
  } catch {
    // Best-effort.
  }
}

// Invite code entered during onboarding (before the user is signed in).
// Pairing needs a Supabase session, so the code is stashed here and redeemed
// by PendingInvitePairer once the user authenticates.
const PENDING_INVITE_CODE_KEY = 'sweatbuds:pendingInviteCode';

export async function setPendingInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, code);
  } catch {
    // Best-effort.
  }
}

export async function getPendingInviteCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_INVITE_CODE_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_CODE_KEY);
  } catch {
    // Best-effort.
  }
}

// Workout-days target picked during onboarding. Stashed here, then applied to
// the user's partnership row at sign-up by PendingInviteRegistrar.
const PENDING_WORKOUT_DAYS_KEY = 'sweatbuds:pendingWorkoutDays';

export async function setPendingWorkoutDays(days: number): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_WORKOUT_DAYS_KEY, String(days));
  } catch {
    // Best-effort.
  }
}

export async function getPendingWorkoutDays(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_WORKOUT_DAYS_KEY);
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// Wager picked during onboarding. Stashed for the weekly-plan setup flow to
// apply to the partnership once one exists.
const PENDING_WAGER_KEY = 'sweatbuds:pendingWager';

export type PendingWager = { emoji: string; label: string; quantity: number };

export async function setPendingWager(wager: PendingWager): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_WAGER_KEY, JSON.stringify(wager));
  } catch {
    // Best-effort.
  }
}

export async function getPendingWager(): Promise<PendingWager | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_WAGER_KEY);
    return raw ? (JSON.parse(raw) as PendingWager) : null;
  } catch {
    return null;
  }
}

// Display name + profile photo entered during onboarding (before sign-in).
// Applied to the user's profile by the post-sign-in setup flow.
const PENDING_NAME_KEY = 'sweatbuds:pendingDisplayName';
const PENDING_PHOTO_KEY = 'sweatbuds:pendingPhotoUri';

export async function setPendingDisplayName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_NAME_KEY, name);
  } catch {
    // Best-effort.
  }
}

export async function getPendingDisplayName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_NAME_KEY);
  } catch {
    return null;
  }
}

export async function setPendingPhotoUri(uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_PHOTO_KEY, uri);
  } catch {
    // Best-effort.
  }
}

export async function getPendingPhotoUri(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_PHOTO_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingDisplayName(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_NAME_KEY);
  } catch {
    // Best-effort.
  }
}

export async function clearPendingPhotoUri(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_PHOTO_KEY);
  } catch {
    // Best-effort.
  }
}

// The user's own invite code, generated on-device during onboarding so it can
// be shared before sign-up. PendingInviteRegistrar writes it to the database
// (a partnerships row) once the user authenticates.
const MY_INVITE_CODE_KEY = 'sweatbuds:myInviteCode';

export async function getOrCreatePendingInviteCode(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(MY_INVITE_CODE_KEY);
    if (existing) return existing;
    const code = generateInviteCode();
    await AsyncStorage.setItem(MY_INVITE_CODE_KEY, code);
    return code;
  } catch {
    // Storage unavailable — return a fresh code so the share still works.
    return generateInviteCode();
  }
}

export async function getMyPendingInviteCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(MY_INVITE_CODE_KEY);
  } catch {
    return null;
  }
}

export async function clearMyPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MY_INVITE_CODE_KEY);
  } catch {
    // Best-effort.
  }
}

// Returns `null` while the flag is still loading, then the boolean value.
export function useOnboardingSeen(): { seen: boolean | null } {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getOnboardingSeen().then((value) => {
      if (active) setSeen(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return { seen };
}

// Returns `null` while the paywall flag is still loading, then the boolean.
export function usePaywallSeen(): { seen: boolean | null } {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getPaywallSeen().then((value) => {
      if (active) setSeen(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return { seen };
}
