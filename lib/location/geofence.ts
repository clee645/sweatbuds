import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { SavedLocation } from '@/types/db';

export const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

async function isStarted(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  } catch {
    return false;
  }
}

export async function syncGeofences(saved: SavedLocation[]): Promise<void> {
  if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
    console.warn('[geofence] task not defined at module load; skipping sync');
    return;
  }

  if (saved.length === 0) {
    if (await isStarted()) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    return;
  }

  const regions = saved.slice(0, 20).map((s) => ({
    identifier: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    radius: s.radius_meters ?? 150,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  // startGeofencingAsync replaces any existing region set for this task.
  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
}

export async function stopAllGeofences(): Promise<void> {
  if (await isStarted()) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
}
