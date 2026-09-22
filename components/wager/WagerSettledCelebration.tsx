import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfettiBurst } from '@/components/onboarding/ConfettiBurst';
import { colors, spacing, typography } from '@/lib/theme';

type Props = {
  terms: string;
  youWon: boolean;
  partnerName: string;
  onDismiss: () => void;
};

// Full-screen overlay shown after "Mark one as done" on Wager Balance.
// Rendered inside the screen (not a route) so dismissing drops the user right
// back onto the carousel they were on.
export function WagerSettledCelebration({ terms, youWon, partnerName, onDismiss }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const title = youWon ? 'Paid up!' : 'Debt cleared!';
  const subtitle = youWon
    ? `${partnerName} settled up with you`
    : `You settled up with ${partnerName}`;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
    >
      <Pressable style={styles.root} onPress={onDismiss}>
        <LinearGradient
          colors={['rgba(255, 90, 95, 0.22)', 'rgba(255, 90, 95, 0.05)', 'rgba(0, 0, 0, 0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <ConfettiBurst />

        <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.spacer} />

          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.center}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.terms} numberOfLines={2} adjustsFontSizeToFit>
              {terms}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.hint}>Tap anywhere to continue</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  spacer: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 64 },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
  terms: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 16,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  hint: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 13,
  },
});
