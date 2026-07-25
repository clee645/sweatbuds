import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getPermissionLevel, type PermissionLevel } from './permissions';

export function useLocationPermission() {
  const [level, setLevel] = useState<PermissionLevel>('undetermined');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getPermissionLevel();
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
