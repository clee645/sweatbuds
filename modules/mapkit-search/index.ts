import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type MapKitPlace = {
  identifier: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

type NativeMapKitSearch = {
  searchAsync(
    query: string,
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<MapKitPlace[]>;
};

const native: NativeMapKitSearch | null =
  Platform.OS === 'ios' ? requireNativeModule<NativeMapKitSearch>('MapKitSearch') : null;

export async function searchAsync(
  query: string,
  latitude?: number,
  longitude?: number,
): Promise<MapKitPlace[]> {
  if (!native) {
    throw new Error('MapKit search is iOS-only.');
  }
  return native.searchAsync(query, latitude ?? null, longitude ?? null);
}
