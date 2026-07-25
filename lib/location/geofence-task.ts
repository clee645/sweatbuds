import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { getCachedName } from './savedLocations';

const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[geofence] task error', error);
    return;
  }
  const payload = data as
    | { eventType: Location.GeofencingEventType; region: Location.LocationRegion }
    | undefined;
  if (!payload) return;
  if (payload.eventType !== Location.GeofencingEventType.Enter) return;

  const identifier = payload.region.identifier ?? '';
  const name = (await getCachedName(identifier)) ?? 'your gym';

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `You arrived at ${name}`,
        body: 'Log your workout!',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[geofence] notification failed', e);
  }
});
