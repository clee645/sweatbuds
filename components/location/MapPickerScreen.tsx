import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentCoordinate } from '@/lib/location/permissions';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Coord = { latitude: number; longitude: number };

type Props = {
  visible: boolean;
  initialCoord: Coord | null;
  onCancel: () => void;
  onConfirm: (place: {
    identifier: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
  }) => void;
};

const FALLBACK_COORD: Coord = { latitude: 37.7749, longitude: -122.4194 };

export function MapPickerScreen({ visible, initialCoord, onCancel, onConfirm }: Props) {
  const mapRef = useRef<MapView>(null);
  const [coord, setCoord] = useState<Coord | null>(initialCoord);
  const [address, setAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const fresh = (await getCurrentCoordinate()) ?? initialCoord ?? FALLBACK_COORD;
      if (cancelled) return;
      setCoord(fresh);
      mapRef.current?.animateToRegion(
        { ...fresh, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        300,
      );
      void resolveAddress(fresh);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const resolveAddress = async (next: Coord) => {
    setResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync(next);
      const first = results[0];
      if (first) {
        const parts = [
          [first.streetNumber, first.street].filter(Boolean).join(' '),
          first.city,
          first.region,
        ].filter(Boolean);
        setAddress(parts.length > 0 ? parts.join(', ') : null);
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    } finally {
      setResolving(false);
    }
  };

  const onRegionChangeComplete = (region: Region) => {
    const next = { latitude: region.latitude, longitude: region.longitude };
    setCoord(next);
    void resolveAddress(next);
  };

  const recenter = async () => {
    const me = await getCurrentCoordinate();
    if (!me) return;
    setCoord(me);
    mapRef.current?.animateToRegion(
      { ...me, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      300,
    );
    void resolveAddress(me);
  };

  const confirm = () => {
    if (!coord) return;
    const name = address ?? 'Custom location';
    onConfirm({
      identifier: `custom:${coord.latitude.toFixed(6)},${coord.longitude.toFixed(6)}`,
      name,
      address,
      latitude: coord.latitude,
      longitude: coord.longitude,
    });
  };

  if (!visible) return null;

  const center = coord ?? FALLBACK_COORD;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation
        onRegionChangeComplete={onRegionChangeComplete}
      />

      <View style={styles.centerPin} pointerEvents="none">
        <Ionicons name="location-sharp" size={40} color="#FF3B30" style={styles.centerPinIcon} />
      </View>

      <SafeAreaView style={styles.topRow} edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          hitSlop={12}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.hintPill}>
          <Text style={styles.hintText}>Drag map to position pin</Text>
        </View>
        <Pressable
          onPress={() => void recenter()}
          style={({ pressed }) => [styles.recenterBtn, pressed && styles.pressed]}
          hitSlop={12}
        >
          <Ionicons name="navigate" size={18} color="#0A84FF" />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.footer} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.footerCard}>
          <Text style={styles.address} numberOfLines={2}>
            {resolving ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              address ?? 'Drop a pin to choose this spot'
            )}
          </Text>
          <Pressable
            onPress={confirm}
            style={({ pressed }) => [styles.useBtn, pressed && styles.pressed]}
          >
            <Text style={styles.useText}>Use this location</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintPill: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  hintText: { ...typography.bodyStrong, fontSize: 14 },
  recenterBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  centerPin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinIcon: {
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
  },
  footerCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  address: {
    ...typography.body,
    fontSize: 15,
    textAlign: 'center',
  },
  useBtn: {
    backgroundColor: colors.text,
    borderRadius: radii.pill,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  useText: {
    ...typography.bodyStrong,
    fontSize: 17,
    color: colors.bg,
  },
});
