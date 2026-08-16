import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAuth } from '@/lib/auth';
import { useWorkoutComments } from '@/lib/comments';
import { useCommentViews } from '@/lib/commentViews';
import { getCachedSignedUrls, getSignedUrls, workoutImageSource } from '@/lib/storage';
import { colors, spacing, typography } from '@/lib/theme';
import { timeAgo } from '@/lib/time';
import type { Workout } from '@/types/db';
import { WorkoutCard } from './WorkoutCard';

type Props = {
  workouts: Workout[];
  // When set to true, the stack fades + scales + lifts away to signal that
  // the prior week is being archived. Parent should swap to the next view
  // once the animation completes (~700ms total including settle).
  archiving?: boolean;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY = 800;
const MAX_VISIBLE = 3;
const STACK_OFFSET_X = 10;
const STACK_OFFSET_Y = 10;
const STACK_ROTATE_DEG = 5;
const STACK_SCALE_STEP = 0.04;
const OFFSCREEN_ROTATE_DEG = 24;

// Above this count, the pagination row collapses to WINDOW_SIZE fixed slots
// so the dots never overflow the screen. Edge slots shrink to hint at
// off-window items.
const WINDOW_THRESHOLD = 8;
const WINDOW_SIZE = 7;
type DotSizeClass = 'active' | 'near' | 'mid' | 'edge';

function cardTransform(effective: number) {
  'worklet';
  let x: number;
  let y: number;
  let rot: number;
  let scale: number;
  if (effective < 0) {
    x = effective * SCREEN_WIDTH;
    y = 0;
    rot = effective * OFFSCREEN_ROTATE_DEG;
    scale = 1;
  } else {
    x = effective * STACK_OFFSET_X;
    y = -effective * STACK_OFFSET_Y;
    rot = effective * STACK_ROTATE_DEG;
    scale = 1 - effective * STACK_SCALE_STEP;
  }
  return {
    transform: [
      { translateX: x },
      { translateY: y },
      { rotateZ: `${rot}deg` },
      { scale },
    ],
  };
}

type AnimatedSlotProps = {
  cardIndex: number;
  floatIndex: SharedValue<number>;
  zIndex: number;
  children: React.ReactNode;
};

function AnimatedSlot({ cardIndex, floatIndex, zIndex, children }: AnimatedSlotProps) {
  const animatedStyle = useAnimatedStyle(() =>
    cardTransform(cardIndex - floatIndex.value),
  );
  return (
    <Animated.View style={[styles.cardSlot, { zIndex }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

export function WorkoutCarousel({ workouts, archiving = false }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { byWorkout } = useWorkoutComments();
  const { unreadCount } = useCommentViews();
  const [activeIndex, setActiveIndex] = useState(0);
  const archiveProgress = useSharedValue(0);

  useEffect(() => {
    archiveProgress.value = withTiming(archiving ? 1 : 0, {
      duration: archiving ? 600 : 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [archiving, archiveProgress]);

  const archiveStyle = useAnimatedStyle(() => {
    const p = archiveProgress.value;
    return {
      opacity: 1 - p,
      transform: [
        { scale: interpolate(p, [0, 1], [1, 0.92]) },
        { translateY: interpolate(p, [0, 1], [0, -20]) },
      ],
    };
  });
  const [uriMap, setUriMap] = useState<Record<string, string>>(() => {
    // Seed from the in-memory signed-URL cache so the first paint already has
    // valid URIs for paths we've fetched before. Without this, the first render
    // passes raw storage paths to <Image>, the URI changes once the async fetch
    // resolves, and expo-image plays a fade-in that reads as a flicker.
    const paths = workouts.flatMap((w) =>
      [w.selfie_path, w.environment_path].filter((p): p is string => Boolean(p)),
    );
    return getCachedSignedUrls(paths);
  });

  const floatIndex = useSharedValue(0);
  // The authoritative index, on the UI thread. React state lands a frame or
  // more after a gesture ends, so the pan handler cannot read `activeIndex`
  // and still be correct during a fast burst of swipes.
  const committedIndex = useSharedValue(0);
  // Where floatIndex sat when the current drag began. Capturing it lets a drag
  // that interrupts a still-settling animation continue from what's on screen
  // instead of snapping back to the last committed card.
  const dragStart = useSharedValue(0);

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
      if (cancelled) return;
      // Skip the state update when nothing changed — avoids a redundant re-render
      // that would otherwise pass freshly-allocated source objects to <Image>.
      setUriMap((prev) => {
        const keys = Object.keys(map);
        if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === map[k])) {
          return prev;
        }
        return map;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [workouts]);

  // If workouts change underneath us, keep the active index in range.
  useEffect(() => {
    if (activeIndex >= workouts.length && workouts.length > 0) {
      setActiveIndex(0);
    }
  }, [workouts.length, activeIndex]);

  // Re-sync only when something OUTSIDE the gesture moved the index (initial
  // mount, workouts mutation, the clamp above). A swipe sets committedIndex
  // before it hands the value to React, so this is a no-op on that path —
  // which matters, because assigning floatIndex here would cut the settle
  // animation short the instant activeIndex updates.
  useEffect(() => {
    if (Math.round(committedIndex.value) !== activeIndex) {
      committedIndex.value = activeIndex;
      floatIndex.value = activeIndex;
    }
  }, [activeIndex, committedIndex, floatIndex]);

  const openDetail = () => {
    const w = workouts[activeIndex];
    if (w) router.push(`/photo/${w.id}`);
  };

  const lastIndex = workouts.length - 1;

  const swipeGesture = Gesture.Pan()
    // Let a stationary press fall through to the tap gesture instead of
    // winning the Exclusive race as a zero-distance pan.
    .activeOffsetX([-8, 8])
    .onBegin(() => {
      dragStart.value = floatIndex.value;
    })
    .onUpdate((e) => {
      floatIndex.value = dragStart.value - e.translationX / SCREEN_WIDTH;
    })
    .onEnd((e) => {
      const passedThreshold =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY;

      // Step from the last COMMITTED index rather than the on-screen position.
      // A flick that lands mid-animation is still a whole card's worth of
      // intent, so a burst of fast swipes advances one card each instead of
      // rounding back to where the animation happened to be.
      let target = passedThreshold
        ? committedIndex.value + (e.translationX < 0 ? 1 : -1)
        : Math.round(floatIndex.value);
      target = Math.min(Math.max(target, 0), lastIndex);

      committedIndex.value = target;
      floatIndex.value = withSpring(target, {
        // Carry the fling's momentum so a hard swipe settles faster than a
        // lazy one, instead of every swipe taking a fixed 500ms.
        velocity: -e.velocityX / SCREEN_WIDTH,
        damping: 20,
        stiffness: 220,
        mass: 0.5,
        overshootClamping: true,
      });
      // Hand the index to React NOW, not in the animation's completion
      // callback. The dots and the mounted-card window used to wait out the
      // entire animation before updating — that wait is what made rapid
      // swiping feel like it was blocking on the indicator.
      runOnJS(setActiveIndex)(target);
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success) runOnJS(openDetail)();
    });

  const composedGesture = Gesture.Exclusive(swipeGesture, tapGesture);

  const dotSlots = useMemo(() => {
    const total = workouts.length;
    if (total <= WINDOW_THRESHOLD) return null;
    const half = (WINDOW_SIZE - 1) / 2;
    const center = Math.min(Math.max(activeIndex, half), total - 1 - half);
    const slots: { workoutIndex: number; sizeClass: DotSizeClass }[] = [];
    for (let i = center - half; i <= center + half; i++) {
      const distance = Math.abs(i - activeIndex);
      const sizeClass: DotSizeClass =
        distance === 0 ? 'active' : distance === 1 ? 'near' : distance === 2 ? 'mid' : 'edge';
      slots.push({ workoutIndex: i, sizeClass });
    }
    return slots;
  }, [activeIndex, workouts]);

  if (workouts.length === 0) return null;

  // Visible window: previous card + active + back stack. Each card is keyed by
  // workout.id and identified by its absolute array position (cardIndex), so
  // the same React component instance survives activeIndex changes — its style
  // just shifts as floatIndex moves. Image stays mounted, no reload flash.
  const start = Math.max(0, activeIndex - 1);
  const end = Math.min(workouts.length, activeIndex + MAX_VISIBLE);
  const visible: { workout: Workout; cardIndex: number }[] = [];
  for (let i = start; i < end; i++) {
    visible.push({ workout: workouts[i], cardIndex: i });
  }

  const active = workouts[activeIndex];

  const renderCard = (workout: Workout) => (
    <WorkoutCard
      selfie={workoutImageSource(workout.selfie_path, uriMap)}
      environment={
        workout.environment_path
          ? workoutImageSource(workout.environment_path, uriMap)
          : null
      }
      caption={workout.caption}
      showCommentIcon
      unreadCount={unreadCount(
        workout.id,
        byWorkout[workout.id] ?? [],
        user?.id,
      )}
    />
  );

  return (
    <Animated.View style={[styles.wrap, archiveStyle]}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.stack}>
          {visible.map(({ workout, cardIndex }) => {
            // Previous card sits on top so it covers active during a retreat
            // gesture; otherwise the back stack is layered by depth.
            const distance = cardIndex - activeIndex;
            const zIndex = distance < 0 ? MAX_VISIBLE + 1 : MAX_VISIBLE - distance;
            return (
              <AnimatedSlot
                key={workout.id}
                cardIndex={cardIndex}
                floatIndex={floatIndex}
                zIndex={zIndex}
              >
                {renderCard(workout)}
              </AnimatedSlot>
            );
          })}
        </View>
      </GestureDetector>

      <Text style={styles.timeAgo}>{timeAgo(active.logged_at)}</Text>

      {workouts.length >= 2 ? (
        <View style={styles.dots}>
          {dotSlots
            ? dotSlots.map(({ workoutIndex, sizeClass }) => (
                <View
                  key={workouts[workoutIndex].id}
                  style={[styles.dot, dotStyleFor(sizeClass)]}
                />
              ))
            : workouts.map((w, i) => (
                <View
                  key={w.id}
                  style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
                />
              ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  stack: {
    flex: 1,
    width: '100%',
    aspectRatio: 4 / 5,
    maxWidth: SCREEN_WIDTH - spacing.sm * 2,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlot: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  timeAgo: {
    ...typography.bodyStrong,
    fontSize: 18,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: { width: 18, backgroundColor: colors.accent },
  dotInactive: { width: 6, backgroundColor: colors.textDim },
  dotNear: { width: 6, backgroundColor: colors.textDim },
  dotMid: { width: 5, backgroundColor: colors.textDim },
  dotEdge: { width: 4, backgroundColor: colors.textDim, opacity: 0.6 },
});

function dotStyleFor(sizeClass: DotSizeClass) {
  switch (sizeClass) {
    case 'active':
      return styles.dotActive;
    case 'near':
      return styles.dotNear;
    case 'mid':
      return styles.dotMid;
    case 'edge':
      return styles.dotEdge;
  }
}
