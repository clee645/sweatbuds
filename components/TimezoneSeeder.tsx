import { useEffect, useRef } from 'react';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { deviceTimezone } from '@/lib/zonedTime';

// Profiles are created by a server trigger that has no idea where the device
// is, so `profiles.timezone` starts as 'America/Los_Angeles' for everyone —
// including a signup in Berlin. That value was never a choice anyone made.
//
// This fills it in from the device on first launch. No location permission is
// involved: the OS already knows its own timezone (it's the setting behind the
// lock-screen clock, populated from the cellular network), and we only read
// that. We learn the user's *zone*, never their location.
//
// Deliberately does NOT follow travel. A trip would otherwise shift your week
// mid-flight; moving permanently is rare enough to be a manual change.
//
// Renders nothing.
const LEGACY_DEFAULT = 'America/Los_Angeles';

export function TimezoneSeeder() {
  const { user, profile, refreshProfile } = useAuth();
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !profile) return;

    // A timezone the user picked themselves is final — never auto-detect over
    // it. This flag lives on the ACCOUNT rather than the device, so a reinstall
    // or a new phone can't resurrect the detection and clobber their choice.
    if (profile.timezone_set_by_user) return;

    const stored = profile.timezone;
    const device = deviceTimezone();

    // Only ever fill in a value nobody chose: null, or the untouched server
    // default. Once a real zone is stored, leave it alone — that's what makes
    // this a one-time seed rather than a travel tracker.
    const shouldSeed = (!stored || stored === LEGACY_DEFAULT) && device !== stored;
    if (!shouldSeed) return;

    // Guard against a second pass while the first write is still in flight;
    // the effect re-runs on every `profile` identity change.
    if (inFlight.current === userId) return;
    inFlight.current = userId;

    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ timezone: device })
        .eq('id', userId);
      if (error) {
        // Leave everything untouched so the next launch retries.
        inFlight.current = null;
        if (__DEV__) console.warn('[timezone] seed failed', error);
        return;
      }
      if (!cancelled) await refreshProfile().catch(() => undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profile, refreshProfile]);

  return null;
}
