import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { useNotificationPermission } from '@/lib/location/useNotificationPermission';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { SavedLocation } from '@/types/db';

const NEARBY_DEFAULT_QUERY = 'gym';

export function ManagerScreen() {
  const { user } = useAuth();
  const {
    level: notificationLevel,
    loading: notificationLoading,
    refresh: refreshNotifications,
  } = useNotificationPermission();
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
  const [geofenceFailed, setGeofenceFailed] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const searcher = useRef<DebouncedMapKitSearch | null>(null);

  if (!searcher.current) {
    searcher.current = new DebouncedMapKitSearch();
  }

  // syncGeofences hands the region list to CoreLocation and can fail — a
  // misconfigured Info.plist, or permission revoked between renders. The saved
  // list on screen is still correct, so this stays fire-and-forget rather than
  // blocking the add; but the outcome drives a banner, because a saved gym
  // that was never registered looks exactly like one that was.
  const pushGeofences = useCallback((list: SavedLocation[]) => {
    void syncGeofences(list).then((result) => {
      setGeofenceFailed(!result.ok);
      if (!result.ok) console.warn('[geofence] sync failed', result.reason, result.error);
    });
  }, []);

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
      pushGeofences(list);
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

  // Location permission alone is not enough — arrival events fire but the
  // reminder has no way to reach the user. Surface that here, since a user who
  // is already on "Always" never passes through GateScreen.
  const notificationsBlocked = !notificationLoading && notificationLevel !== 'granted';

  const fixNotifications = () => {
    if (notificationLevel === 'denied') {
      void Linking.openSettings();
      return;
    }
    void (async () => {
      await ensureNotificationPermission();
      await refreshNotifications();
    })();
  };

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

    void ensureNotificationPermission().then(() => refreshNotifications());

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
    pushGeofences(next);
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
    pushGeofences(next);
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

      {notificationsBlocked ? (
        <Pressable
          onPress={fixNotifications}
          style={({ pressed }) => [styles.notifyWarning, pressed && styles.pressed]}
        >
          <Ionicons name="notifications-off-outline" size={16} color={colors.warning} />
          <Text style={styles.notifyWarningText}>
            Notifications are off, so we can't nudge you when you arrive.{' '}
            <Text style={styles.notifyWarningAction}>
              {notificationLevel === 'denied' ? 'Open Settings' : 'Turn on'}
            </Text>
          </Text>
        </Pressable>
      ) : null}

      {/* Registration failed, so nothing is being watched — even though the
          saved list below renders normally. Offer the retry rather than a dead
          end, since the common causes (a permission flip, a transient
          CoreLocation error) can clear on a second attempt. */}
      {geofenceFailed ? (
        <Pressable
          onPress={() => pushGeofences(saved)}
          style={({ pressed }) => [styles.notifyWarning, pressed && styles.pressed]}
        >
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={styles.notifyWarningText}>
            We couldn't set up arrival reminders, so we can't nudge you at these spots.{' '}
            <Text style={styles.notifyWarningAction}>Try again</Text>
          </Text>
        </Pressable>
      ) : null}

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
  notifyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.cardMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warning,
  },
  notifyWarningText: {
    flex: 1,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
  },
  notifyWarningAction: {
    color: colors.accent,
    fontWeight: '600',
  },
  pressed: { opacity: 0.6 },
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
