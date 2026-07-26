import * as Notifications from 'expo-notifications';

// 'denied' means we can no longer prompt — the only route back is iOS Settings.
// 'undetermined' means an in-app prompt will still work.
export type NotificationLevel = 'granted' | 'denied' | 'undetermined';

export async function getNotificationLevel(): Promise<NotificationLevel> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return next.granted;
}
