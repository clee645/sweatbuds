import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getNotificationLevel, type NotificationLevel } from './notifications';

// Mirrors useLocationPermission. Arrival reminders need BOTH "Always" location
// (to wake us) and notification permission (to actually surface anything), so
// the location screens track them side by side. Re-checks on foreground to
// catch changes made in iOS Settings.
export function useNotificationPermission() {
  const [level, setLevel] = useState<NotificationLevel>('undetermined');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getNotificationLevel();
    setLevel(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  return { level, loading, refresh };
}
