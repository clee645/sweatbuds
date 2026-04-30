import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { getCachedSignedUrls, getSignedUrls } from '@/lib/storage';
import { colors, spacing, typography } from '@/lib/theme';
import { timeAgo } from '@/lib/time';
import type { Workout } from '@/types/db';
import { WorkoutCard } from './WorkoutCard';

type Props = {
  workouts: Workout[];
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

export function WorkoutCarousel({ workouts }: Props) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
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

  // Keep floatIndex in lockstep with activeIndex on external state changes
  // (initial mount, workouts mutation). After a swipe, floatIndex is already
  // at the new activeIndex when this effect runs, so the assignment is a no-op.
  useEffect(() => {
    floatIndex.value = activeIndex;
  }, [activeIndex, floatIndex]);

  const openDetail = () => {
    const w = workouts[activeIndex];
    if (w) router.push(`/photo/${w.id}`);
  };

  const swipeGesture = Gesture.Pan()
    .onChange((e) => {
      floatIndex.value = activeIndex - e.translationX / SCREEN_WIDTH;
    })
    .onEnd((e) => {
      const passedThreshold =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY;
      const timingConfig = { duration: 500, easing: Easing.out(Easing.cubic) };

      if (e.translationX < 0 && passedThreshold && activeIndex < workouts.length - 1) {
        const next = activeIndex + 1;
        floatIndex.value = withTiming(next, timingConfig, (finished) => {
          if (finished) runOnJS(setActiveIndex)(next);
        });
      } else if (e.translationX > 0 && passedThreshold && activeIndex > 0) {
        const prev = activeIndex - 1;
        floatIndex.value = withTiming(prev, timingConfig, (finished) => {
          if (finished) runOnJS(setActiveIndex)(prev);
        });
      } else {
        floatIndex.value = withSpring(activeIndex, { damping: 22, stiffness: 100 });
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success) runOnJS(openDetail)();
    });

  const composedGesture = Gesture.Exclusive(swipeGesture, tapGesture);

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
      selfieUri={uriMap[workout.selfie_path] ?? workout.selfie_path}
      environmentUri={
        workout.environment_path
          ? (uriMap[workout.environment_path] ?? workout.environment_path)
          : null
      }
      caption={workout.caption}
    />
  );

  return (
    <View style={styles.wrap}>
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

      <View style={styles.dots}>
        {workouts.map((w, i) => (
          <View
            key={w.id}
            style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
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
});
