import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfettiBurst } from '@/components/onboarding/ConfettiBurst';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { setPaywallSeen } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

// Paywall flow, screen 4 — the celebration shown after the user "subscribes".
export default function PaywallSuccessScreen() {
  const router = useRouter();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const finish = async () => {
    await setPaywallSeen();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['rgba(255, 90, 95, 0.28)', 'rgba(255, 90, 95, 0.06)', 'rgba(0, 0, 0, 0)']}
        start={{ x: 0.5, y: 0.1 }}
        end={{ x: 0.5, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ConfettiBurst />

      <View style={styles.content}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.glow}>
          <View style={styles.circle}>
            <Ionicons name="flame" size={64} color="#FFFFFF" />
          </View>
        </Animated.View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>
            You&apos;re now the kind of person who follows through
          </Text>
          <Text style={styles.subtitle}>
            Doing this together is going to change how consistent you are
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          variant="primary"
          label="Stay consistent together"
          onPress={finish}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxxl,
  },
  glow: {
    borderRadius: 999,
    shadowColor: colors.orange,
    shadowOpacity: 0.9,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  circle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
