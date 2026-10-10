import AsyncStorage from '@react-native-async-storage/async-storage';

// Last-known server state, per user, so a cold start without network renders
// the real home (paired, with workouts) instead of an unpaired empty one, and
// a cold start with network paints immediately while the fetch revalidates.
// Never authoritative: providers overwrite it with the first live answer.

export const partnerCoveredKey = (uid: string) => `sweatbuds:partnerCovered:${uid}`;
export const partnershipCacheKey = (uid: string) => `sweatbuds:cache:partnership:${uid}`;
export const workoutsCacheKey = (uid: string) => `sweatbuds:cache:workouts:${uid}`;

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

// Called on sign-out so the next account on this device starts clean and a
// signed-out user's partner/workouts don't linger on disk.
export async function clearUserCaches(uid: string): Promise<void> {
  await AsyncStorage.multiRemove([
    partnerCoveredKey(uid),
    partnershipCacheKey(uid),
    workoutsCacheKey(uid),
  ]).catch(() => {});
}
