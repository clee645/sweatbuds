import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/photo-detail/ActionMenu';
import { WorkoutCard } from '@/components/home/WorkoutCard';
import { getSignedUrls } from '@/lib/storage';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { deleteWorkout, useWorkouts } from '@/lib/workouts';
import type { Workout } from '@/types/db';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_PADDING = spacing.lg;

export default function PhotoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, removeWorkout } = useWorkouts();

  const initialIndex = useMemo(() => {
    const i = workouts.findIndex((w) => w.id === id);
    return i >= 0 ? i : 0;
  }, [workouts, id]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uriMap, setUriMap] = useState<Record<string, string>>({});
  const listRef = useRef<FlatList<Workout>>(null);

  useEffect(() => {
    let cancelled = false;
    const paths = workouts.flatMap((w) =>
      [w.selfie_path, w.environment_path].filter((p): p is string => Boolean(p)),
    );
    if (paths.length === 0) {
      setUriMap({});
      return;
    }
    getSignedUrls(paths).then((map) => {
      if (!cancelled) setUriMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [workouts]);

  useEffect(() => {
    if (workouts.length === 0) {
      router.back();
    }
  }, [workouts.length, router]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndex(first.index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const active = workouts[activeIndex];

  const handleShare = () => {
    if (!active) return;
    setMenuOpen(false);
    router.push(`/share-sweatcam/${active.id}`);
  };

  const handleSave = async () => {
    if (!active) return;
    setMenuOpen(false);
    const selfieUri = uriMap[active.selfie_path];
    if (!selfieUri) return;
    const { saveToPhotos } = await import('@/lib/share');
    const ok = await saveToPhotos(selfieUri);
    if (ok) Alert.alert('Saved', 'Sweatcam saved to your photo library.');
  };

  const handleDelete = () => {
    if (!active) return;
    setMenuOpen(false);
    Alert.alert(
      'Delete workout?',
      'This will remove the workout and its photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkout(active);
              removeWorkout(active.id);
            } catch (err) {
              Alert.alert(
                'Could not delete',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  if (!active) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.chrome}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.dateText}>{formatDate(active.logged_at)}</Text>
          <Text style={styles.timeText}>{formatTime(active.logged_at)}</Text>
        </View>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={26} color={colors.text} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={workouts}
        keyExtractor={(w) => w.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <View style={styles.cardFrame}>
              <WorkoutCard
                selfieUri={uriMap[item.selfie_path] ?? item.selfie_path}
                environmentUri={
                  item.environment_path
                    ? (uriMap[item.environment_path] ?? item.environment_path)
                    : null
                }
                caption={null}
                envSize="large"
              />
            </View>
            {item.caption ? (
              <View style={styles.captionBubble}>
                <Text style={styles.caption} numberOfLines={3}>
                  {item.caption}
                </Text>
              </View>
            ) : (
              <View style={[styles.captionBubble, styles.captionBubbleEmpty]}>
                <Text style={[styles.caption, styles.captionEmpty]}>No caption</Text>
              </View>
            )}
          </View>
        )}
      />

      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onShare={handleShare}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(/^0/, '');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { alignItems: 'center', flex: 1 },
  dateText: { ...typography.bodyStrong, fontSize: 16 },
  timeText: { ...typography.caption, fontSize: 12, marginTop: 2 },
  page: {
    width: SCREEN_WIDTH,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.lg,
  },
  cardFrame: {
    width: SCREEN_WIDTH - PAGE_PADDING * 2,
    aspectRatio: 4 / 5,
  },
  captionBubble: {
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.cardElevated,
  },
  captionBubbleEmpty: {
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
  },
  caption: {
    ...typography.body,
    fontSize: 16,
    textAlign: 'center',
  },
  captionEmpty: {
    color: colors.textDim,
  },
});
