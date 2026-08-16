import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { SavedLocation } from '@/types/db';

export const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

// CoreLocation monitors at most 20 regions per app, process-wide. Separate
// from MAX_LOCATIONS (our product cap) even though both are currently 20 —
// this one is Apple's and we don't get to raise it.
const IOS_MAX_REGIONS = 20;

// A failed registration used to be indistinguishable from a successful one:
// callers awaited a void promise and logged whatever it threw. That hid a
// missing `location` background mode for an entire release — the saved list
// rendered fine while CoreLocation had been handed nothing at all. Callers now
// get the outcome back so the UI can admit when reminders aren't actually armed.
export type GeofenceSyncResult =
  | { ok: true }
  | { ok: false; reason: 'task-undefined' | 'registration-failed'; error?: unknown };

async function isStarted(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  } catch {
    return false;
  }
}

export async function syncGeofences(saved: SavedLocation[]): Promise<GeofenceSyncResult> {
  if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
    console.warn('[geofence] task not defined at module load; skipping sync');
    return { ok: false, reason: 'task-undefined' };
  }

  try {
    if (saved.length === 0) {
      if (await isStarted()) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      return { ok: true };
    }

    const regions = saved.slice(0, IOS_MAX_REGIONS).map((s) => ({
      identifier: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      radius: s.radius_meters ?? 150,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    // startGeofencingAsync replaces any existing region set for this task.
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
    return { ok: true };
  } catch (error) {
    console.warn('[geofence] registration failed', error);
    return { ok: false, reason: 'registration-failed', error };
  }
}

export async function stopAllGeofences(): Promise<void> {
  if (await isStarted()) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
}
