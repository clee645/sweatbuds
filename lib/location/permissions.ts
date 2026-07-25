import * as Location from 'expo-location';

export type PermissionLevel = 'always' | 'whenInUse' | 'denied' | 'undetermined';

export async function getPermissionLevel(): Promise<PermissionLevel> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) {
    return fg.canAskAgain ? 'undetermined' : 'denied';
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'whenInUse';
}

export async function requestForegroundThenBackground(): Promise<PermissionLevel> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return fg.canAskAgain ? 'undetermined' : 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'whenInUse';
}

export async function getCurrentCoordinate(): Promise<
  { latitude: number; longitude: number } | null
> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return null;
    const last = await Location.getLastKnownPositionAsync();
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    const fresh = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
  } catch {
    return null;
  }
}
