import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii, spacing, typography } from '@/lib/theme';

const VISIBLE_MS = 2200;
const SLIDE_MS = 260;

type Props = {
  partnerName: string;
  onHidden: () => void;
};

export function PartnerJoinedToast({ partnerName, onHidden }: Props) {
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    translateY.value = withTiming(0, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });

    const dismissDelay = SLIDE_MS + VISIBLE_MS;
    translateY.value = withDelay(
      dismissDelay,
      withTiming(-80, { duration: SLIDE_MS, easing: Easing.in(Easing.cubic) }),
    );
    opacity.value = withDelay(
      dismissDelay,
      withTiming(0, { duration: SLIDE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(onHidden)();
      }),
    );
    // Run once per mount; new partner-join toasts get a fresh component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.root, animatedStyle]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.text} numberOfLines={1}>
          🎉 {partnerName} joined your team
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
    borderColor: colors.accentBorderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 14,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
});
