import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { SavedLocation } from '@/types/db';

export const MAX_LOCATIONS = 20;

const NAME_CACHE_PREFIX = 'sweatbuds:loc-name:';
const cacheKey = (id: string) => `${NAME_CACHE_PREFIX}${id}`;

export async function fetchSavedLocations(userId: string): Promise<SavedLocation[]> {
  const { data, error } = await supabase
    .from('saved_locations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedLocation[];
}

export async function addSavedLocation(input: {
  userId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  mapkitIdentifier: string | null;
}): Promise<SavedLocation> {
  const { data, error } = await supabase
    .from('saved_locations')
    .insert({
      user_id: input.userId,
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      mapkit_identifier: input.mapkitIdentifier,
    })
    .select()
    .single();
  if (error) throw error;
  const saved = data as SavedLocation;
  await AsyncStorage.setItem(cacheKey(saved.id), saved.name);
  return saved;
}

export async function deleteSavedLocation(id: string): Promise<void> {
  const { error } = await supabase.from('saved_locations').delete().eq('id', id);
  if (error) throw error;
  await AsyncStorage.removeItem(cacheKey(id));
}

export async function getCachedName(id: string): Promise<string | null> {
  if (!id) return null;
  return AsyncStorage.getItem(cacheKey(id));
}

export async function primeNameCache(saved: SavedLocation[]): Promise<void> {
  await Promise.all(saved.map((s) => AsyncStorage.setItem(cacheKey(s.id), s.name)));
}

export function isDuplicate(
  saved: SavedLocation[],
  candidate: { latitude: number; longitude: number; mapkitIdentifier?: string | null },
): boolean {
  if (candidate.mapkitIdentifier) {
    if (saved.some((s) => s.mapkit_identifier && s.mapkit_identifier === candidate.mapkitIdentifier)) {
      return true;
    }
  }
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return saved.some(
    (s) =>
      round(s.latitude) === round(candidate.latitude) &&
      round(s.longitude) === round(candidate.longitude),
  );
}
