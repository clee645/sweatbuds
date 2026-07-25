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
import { useCommentViews } from '@/lib/commentViews';
import { usePartnership } from '@/lib/partnership';
import { getSignedUrls } from '@/lib/storage';
import { colors, spacing, typography } from '@/lib/theme';
import { deleteWorkout, useWorkouts } from '@/lib/workouts';
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

export default function PhotoDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts, removeWorkout } = useWorkouts();
  const { user, profile } = useAuth();
  const { partner } = usePartnership();
  const { byWorkout, add: addComment } = useWorkoutComments();
  const { markViewed } = useCommentViews();

  const initialIndex = useMemo(() => {
    const i = workouts.findIndex((w) => w.id === id);
    return i >= 0 ? i : 0;
  }, [workouts, id]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uriMap, setUriMap] = useState<Record<string, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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

  // Track keyboard height + animate the layout transitions. We manage this
  // ourselves (instead of KeyboardAvoidingView) so we can both pad the
  // composer above the keyboard AND shrink the photo so the user can see
  // what they're typing as well as the comment thread.
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

  // Refs let the FlatList's frozen onViewableItemsChanged callback read the
  // latest workouts/markViewed without React complaining (FlatList throws if
  // this prop identity changes after mount).
  const workoutsRef = useRef(workouts);
  const markViewedRef = useRef(markViewed);
  useEffect(() => {
    workoutsRef.current = workouts;
  }, [workouts]);
  useEffect(() => {
    markViewedRef.current = markViewed;
  }, [markViewed]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndex(first.index);
        const w = workoutsRef.current[first.index];
        if (w) markViewedRef.current(w.id);
      }
    },
  ).current;

  // Cover the cold-open / push-tap case where the user lands on the initial
  // index without ever scrolling — onViewableItemsChanged may not fire for the
  // initial item depending on FlatList's render timing.
  useEffect(() => {
    const w = workouts[initialIndex];
    if (w) markViewed(w.id);
    // Intentionally only fires when the route id changes, not on every workouts
    // mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const active = workouts[activeIndex];
  const isOwnActive = Boolean(active && user && active.user_id === user.id);
  const isKeyboardOpen = keyboardHeight > 0;
  const cardHeight = isKeyboardOpen ? CARD_HEIGHT_KEYBOARD : CARD_HEIGHT_REST;
  const cardWidth = isKeyboardOpen ? CARD_WIDTH_KEYBOARD : CARD_WIDTH_REST;
  // SafeAreaView already adds insets.bottom; the keyboard "covers" that area
  // when up, so subtract it to avoid double-padding the composer.
  const keyboardPad = isKeyboardOpen
    ? Math.max(0, keyboardHeight - insets.bottom)
    : 0;

  // Map a comment author id to a local Profile (only the current user or the
  // partner can comment, by RLS, so no extra fetch needed).
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

      <View style={[styles.flex, { paddingBottom: keyboardPad }]}>
        <FlatList
          ref={listRef}
          style={styles.flex}
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
