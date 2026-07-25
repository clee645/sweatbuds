import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing, typography } from '@/lib/theme';

type Props = {
  visible: boolean;
  onHidden: () => void;
};

export function AddedToast({ visible, onHidden }: Props) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }, () => {
      'worklet';
      opacity.value = withDelay(
        700,
        withTiming(0, { duration: 280, easing: Easing.in(Easing.cubic) }, (finished) => {
          'worklet';
          if (finished) runOnJS(onHidden)();
        }),
      );
    });
  }, [visible, opacity, onHidden]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.root, overlayStyle]} pointerEvents="none">
      <Ionicons name="checkmark" size={56} color={colors.text} />
      <Text style={styles.text}>Location added</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    zIndex: 10,
  },
  text: { ...typography.bodyStrong, fontSize: 17 },
});
