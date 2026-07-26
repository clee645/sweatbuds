import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { syncGeofences } from '@/lib/location/geofence';
import { getPermissionLevel } from '@/lib/location/permissions';
import { fetchSavedLocations, primeNameCache } from '@/lib/location/savedLocations';

// Mounted once at the root, inside AuthProvider.
//
// iOS persists monitored regions across app restarts, so a returning user on
// the same install keeps their geofences without our help. A *fresh* install
// does not: saved locations come back from Supabase, but nothing has ever been
// handed to CoreLocation on this device. Before this ran at launch, the only
// other caller of syncGeofences was ManagerScreen — so a reinstall or a new
// phone left the feature silently dead (full gym list, zero reminders) until
// the user happened to reopen Settings → Location Reminders.
export function GeofenceSync() {
  const { user } = useAuth();
  // Which user id we've already synced for. Also acts as the retry latch: it
  // stays null while permission is short of "always", so the foreground
  // handler keeps trying.
  const syncedForUserRef = useRef<string | null>(null);

  const sync = useCallback(async (userId: string) => {
    if (syncedForUserRef.current === userId) return;
    try {
      // Region monitoring only delivers on "Always". Leave the latch unset so
      // we retry if the user grants it from iOS Settings later.
      if ((await getPermissionLevel()) !== 'always') return;
      const saved = await fetchSavedLocations(userId);
      await primeNameCache(saved);
      await syncGeofences(saved);
      syncedForUserRef.current = userId;
    } catch (e) {
      console.warn('[geofence] launch sync failed', e);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!user) {
      // Sign-out, or the pre-auth window on cold start. Clear the latch so the
      // next signed-in user re-syncs against their own saved locations.
      syncedForUserRef.current = null;
      return;
    }
    void sync(user.id);
  }, [user, sync]);

  // Permission can flip to "Always" in iOS Settings while we're backgrounded.
  // Retry on foreground until a sync actually lands; once it has, the latch
  // makes this a no-op.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!user) return;
    const handler = (state: AppStateStatus) => {
      if (state !== 'active') return;
      void sync(user.id);
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [user, sync]);

  return null;
}
