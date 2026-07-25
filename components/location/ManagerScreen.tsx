import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddLocationModal } from '@/components/location/AddLocationModal';
import { AddedToast } from '@/components/location/AddedToast';
import { MapPickerScreen } from '@/components/location/MapPickerScreen';
import { RemoveLocationSheet } from '@/components/location/RemoveLocationSheet';
import { SavedLocationRow } from '@/components/location/SavedLocationRow';
import { SearchResultRow } from '@/components/location/SearchResultRow';
import { useAuth } from '@/lib/auth';
import { syncGeofences } from '@/lib/location/geofence';
import { DebouncedMapKitSearch, type MapKitPlace } from '@/lib/location/mapkitSearch';
import { ensureNotificationPermission } from '@/lib/location/notifications';
import { getCurrentCoordinate } from '@/lib/location/permissions';
import {
  MAX_LOCATIONS,
  addSavedLocation,
  deleteSavedLocation,
  fetchSavedLocations,
  isDuplicate,
  primeNameCache,
} from '@/lib/location/savedLocations';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { SavedLocation } from '@/types/db';

const NEARBY_DEFAULT_QUERY = 'gym';

export function ManagerScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapKitPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<SavedLocation[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const [pendingPlace, setPendingPlace] = useState<MapKitPlace | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SavedLocation | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const searcher = useRef<DebouncedMapKitSearch | null>(null);

  if (!searcher.current) {
    searcher.current = new DebouncedMapKitSearch();
  }

  // Load saved locations and bias the search around the user's coordinate.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [coord, list] = await Promise.all([
        getCurrentCoordinate(),
        fetchSavedLocations(user.id),
      ]);
      if (cancelled) return;
      if (coord) {
        searcher.current?.setRegionBias(coord);
        setUserCoord(coord);
      }
      setSaved(list);
      await primeNameCache(list);
      void syncGeofences(list);
      setLoadingSaved(false);
      // Kick off an initial nearby-gym search so the list isn't empty.
      runSearch('');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const runSearch = (text: string) => {
    const effective = text.trim().length > 0 ? text : NEARBY_DEFAULT_QUERY;
    setSearching(true);
    searcher.current?.search(effective, (next, error) => {
      setSearching(false);
      if (error) {
        console.warn('[mapkit] search error', error);
        setResults([]);
        return;
      }
      setResults(next);
    });
  };

  const onChangeQuery = (text: string) => {
    setQuery(text);
    runSearch(text);
  };

  const clearQuery = () => {
    setQuery('');
    runSearch('');
  };

  const atCap = saved.length >= MAX_LOCATIONS;

  const handleConfirmAdd = async (place: MapKitPlace) => {
    if (!user) return;
    if (atCap) {
      Alert.alert('Max reached', `You can save up to ${MAX_LOCATIONS} locations.`);
      return;
    }
    if (
      isDuplicate(saved, {
        latitude: place.latitude,
        longitude: place.longitude,
        mapkitIdentifier: place.identifier,
      })
    ) {
      Alert.alert('Already saved', `${place.name} is already in your list.`);
      return;
    }

    void ensureNotificationPermission();

    const inserted = await addSavedLocation({
      userId: user.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      mapkitIdentifier: place.identifier,
    });

    const next = [inserted, ...saved];
    setSaved(next);
    void syncGeofences(next);
    setPendingPlace(null);
    setToastVisible(true);
    searchInputRef.current?.blur();
    setSearchFocused(false);
    setQuery('');
  };

  const handleConfirmRemove = async (location: SavedLocation) => {
    await deleteSavedLocation(location.id);
    const next = saved.filter((s) => s.id !== location.id);
    setSaved(next);
    void syncGeofences(next);
    setRemoveTarget(null);
  };

  const showSavedSection = saved.length > 0 && query.trim().length === 0 && !searchFocused;
  const visibleResults = useMemo(() => {
    if (!showSavedSection) return results;
    // When no query and saved exist, hide the "nearby" results behind the saved list.
    return [];
  }, [results, showSavedSection]);

  const showResultsList = !showSavedSection;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>Where do you{'\n'}usually work out?</Text>
        <Text style={styles.subtitle}>we'll send a nudge when you get there</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          ref={searchInputRef}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search location or address"
          placeholderTextColor={colors.textDim}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={clearQuery} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
        <View style={styles.searchDivider} />
        <Pressable onPress={() => setMapPickerOpen(true)} hitSlop={8}>
          <Ionicons name="map-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {atCap ? (
        <Text style={styles.capHint}>You can save up to {MAX_LOCATIONS} locations.</Text>
      ) : null}

      {showSavedSection ? (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SavedLocationRow
              name={item.name}
              address={item.address}
              onPressEllipsis={() => setRemoveTarget(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
        />
      ) : null}

      {showResultsList ? (
        <FlatList
          data={visibleResults}
          keyExtractor={(item, idx) => `${item.identifier}-${idx}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SearchResultRow
              name={item.name}
              address={item.address}
              disabled={atCap}
              onAdd={() => setPendingPlace(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            searching || loadingSaved ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            ) : (
              <Text style={styles.empty}>No results.</Text>
            )
          }
        />
      ) : null}

      <AddLocationModal
        visible={pendingPlace !== null}
        place={pendingPlace}
        onCancel={() => setPendingPlace(null)}
        onConfirm={handleConfirmAdd}
      />

      <RemoveLocationSheet
        visible={removeTarget !== null}
        location={removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
      />

      <AddedToast visible={toastVisible} onHidden={() => setToastVisible(false)} />

      <MapPickerScreen
        visible={mapPickerOpen}
        initialCoord={userCoord}
        onCancel={() => setMapPickerOpen(false)}
        onConfirm={(place) => {
          setMapPickerOpen(false);
          setPendingPlace(place);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    fontSize: 14,
    textAlign: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 56,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  search: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
    color: colors.text,
  },
  searchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  capHint: {
    ...typography.caption,
    color: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
  },
  loading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  empty: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
