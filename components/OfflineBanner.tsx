import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useIsOnline } from '@/lib/connectivity';
import { colors, radii, spacing, typography } from '@/lib/theme';

const SLIDE_MS = 260;
const HIDDEN_Y = -80;

// Unlike the pairing toasts this does NOT auto-dismiss — it stays up for as
// long as the device is offline, because the condition it reports is ongoing
// rather than a moment that passed. Mounted once at the root.
export function OfflineBanner() {
  const isOnline = useIsOnline();
  // Kept mounted through the exit animation so the slide-out is visible.
  const [rendered, setRendered] = useState(!isOnline);
  const translateY = useSharedValue(HIDDEN_Y);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!isOnline) {
      setRendered(true);
      translateY.value = withTiming(0, {
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, {
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    translateY.value = withTiming(HIDDEN_Y, {
      duration: SLIDE_MS,
      easing: Easing.in(Easing.cubic),
    });
    opacity.value = withTiming(
      0,
      { duration: SLIDE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setRendered)(false);
      },
    );
  }, [isOnline, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!rendered) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.root, animatedStyle]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.text} numberOfLines={1} accessibilityRole="alert">
          You&rsquo;re offline
        </Text>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  safe: {
    width: '100%',
    alignItems: 'center',
  },
  text: {
    ...typography.bodyStrong,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 14,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
});
