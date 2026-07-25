import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Particles } from '@/components/log/Particles';
import { usePartnership } from '@/lib/partnership';
import { colors, spacing, typography } from '@/lib/theme';

export default function PairingCelebrationScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const { partner, freshlyPaired, consumeFreshlyPaired } = usePartnership();

  // Prefer name passed via the route (captured at navigation time), fall
  // back to whatever the providers know right now. This keeps the screen
  // safe if the partner row briefly isn't loaded yet.
  const partnerName =
    (typeof params.name === 'string' && params.name) ||
    freshlyPaired?.partnerName ||
    partner?.display_name ||
    'your partner';

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Mark as seen as soon as the celebration is showing so we don't also
    // queue the in-app toast or re-route on the next home render.
    consumeFreshlyPaired();
  }, [consumeFreshlyPaired]);

  const handleDismiss = () => {
    router.replace('/');
  };

  return (
    <Pressable style={styles.root} onPress={handleDismiss}>
      <LinearGradient
        colors={['rgba(255, 90, 95, 0.22)', 'rgba(255, 90, 95, 0.05)', 'rgba(0, 0, 0, 0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Particles />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.spacer} />

        <View style={styles.center}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>
            You're teamed up{'\n'}with {partnerName}
          </Text>
          <Text style={styles.subtitle}>Time to stay accountable together</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.hint}>Tap anywhere to continue</Text>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  spacer: { flex: 1 },
  center: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    marginTop: spacing.xs,
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
