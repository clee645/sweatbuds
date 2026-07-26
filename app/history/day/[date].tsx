import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/photo-detail/ActionMenu';
import { CommentComposer } from '@/components/photo-detail/CommentComposer';
import { WorkoutPage } from '@/components/photo-detail/WorkoutPage';
import { useAuth } from '@/lib/auth';
import { useWorkoutComments } from '@/lib/comments';
import { toUserMessage } from '@/lib/errors';
import { useHistoryWorkouts } from '@/lib/history';
import { usePartnership } from '@/lib/partnership';
import { getSignedUrls } from '@/lib/storage';
import { colors, spacing, typography } from '@/lib/theme';
import { useWorkoutSync } from '@/lib/workoutSync';
import { deleteWorkout } from '@/lib/workouts';
import { workoutYmd } from '@/lib/historyWeek';
import type { Profile, Workout } from '@/types/db';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PAGE_PADDING = spacing.lg;
const CARD_HEIGHT_REST = Math.min(
  (SCREEN_WIDTH - PAGE_PADDING * 2) * (5 / 4),
  SCREEN_HEIGHT * 0.52,
);
const CARD_HEIGHT_KEYBOARD = Math.round(SCREEN_HEIGHT * 0.22);
const CARD_WIDTH_REST = CARD_HEIGHT_REST * (4 / 5);
const CARD_WIDTH_KEYBOARD = CARD_HEIGHT_KEYBOARD * (4 / 5);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DayMemoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { workouts: allWorkouts } = useHistoryWorkouts();
  const { removeWorkoutLocal } = useWorkoutSync();
  const { user, profile } = useAuth();
  const { partner, weekTimezone } = usePartnership();
  const { byWorkout, add: addComment } = useWorkoutComments();

  // Workouts logged on the tapped calendar date (couple's zone), oldest first
  // so swiping forward
  // walks the day chronologically.
  const dayWorkouts = useMemo(() => {
    if (!date) return [] as Workout[];
    return allWorkouts
      .filter((w) => workoutYmd(w, weekTimezone) === date)
      .sort((a, b) => +new Date(a.logged_at) - +new Date(b.logged_at));
  }, [allWorkouts, date, weekTimezone]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uriMap, setUriMap] = useState<Record<string, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<Workout>>(null);

  useEffect(() => {
    let cancelled = false;
    const paths = dayWorkouts.flatMap((w) =>
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
  }, [dayWorkouts]);

  useEffect(() => {
    if (dayWorkouts.length === 0) {
      router.back();
    }
  }, [dayWorkouts.length, router]);

  // Mirror photo/[id]'s keyboard handling so the comments composer & photo
  // resize together — same UX, just on a date-scoped feed.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndex(first.index);
      }
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const active = dayWorkouts[activeIndex] ?? dayWorkouts[0];
  const isOwnActive = Boolean(active && user && active.user_id === user.id);
  const isKeyboardOpen = keyboardHeight > 0;
  const cardHeight = isKeyboardOpen ? CARD_HEIGHT_KEYBOARD : CARD_HEIGHT_REST;
  const cardWidth = isKeyboardOpen ? CARD_WIDTH_KEYBOARD : CARD_WIDTH_REST;
  const keyboardPad = isKeyboardOpen
    ? Math.max(0, keyboardHeight - insets.bottom)
    : 0;

  const profileForUserId = (uid: string): Profile | null => {
    if (user && uid === user.id) return profile;
    if (partner && uid === partner.id) return partner;
    return null;
  };

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
              removeWorkoutLocal(active.id);
            } catch (err) {
              Alert.alert(
                'Could not delete',
                toUserMessage(err),
              );
            }
          },
        },
      ],
    );
  };

  const handleSubmitComment = async (content: string) => {
    if (!active) return;
    try {
      await addComment({ workoutId: active.id, content });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Please try again.';
      Alert.alert('Could not post comment', message);
      throw err;
    }
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
          <Text style={styles.dateText}>{formatDayHeader(active.logged_at)}</Text>
          {dayWorkouts.length > 1 ? (
            <Text style={styles.timeText}>
              {activeIndex + 1} of {dayWorkouts.length}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.flex, { paddingBottom: keyboardPad }]}>
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={dayWorkouts}
          keyExtractor={(w) => w.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <WorkoutPage
              workout={item}
              uriMap={uriMap}
              comments={byWorkout[item.id] ?? []}
              profileForUserId={profileForUserId}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              compactCaption={isKeyboardOpen}
            />
          )}
        />

        <CommentComposer isOwnWorkout={isOwnActive} onSubmit={handleSubmitComment} />
      </View>

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

function formatDayHeader(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
});
