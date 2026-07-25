import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { setOnboardingSeen } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding screen 2 — the entry screen. No progress header.
export default function WelcomeScreen() {
  const router = useRouter();

  const handleSignIn = async () => {
    await setOnboardingSeen();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['rgba(239,68,68,0.18)', 'rgba(239,68,68,0)']}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.hero}>
        <Image
          source={require('../../assets/onboarding/fall-off.png')}
          style={styles.image}
          contentFit="contain"
        />

        <View style={styles.textWrap}>
          <Text style={styles.title}>
            You both start strong…{'\n'}
            <Text style={styles.titleMuted}>then fall off together.</Text>
          </Text>
          <Text style={styles.subtitle}>
            Life gets busy. Motivation dips. But you still want to look better and
            feel closer together.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="This is me"
          onPress={() => router.push('/onboarding/consistency')}
        />
        <Pressable onPress={handleSignIn} hitSlop={8} style={styles.signInRow}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </Pressable>
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
  // Soft reddish glow bleeding down from the top edge.
  glow: {
    position: 'absolute',
    top: 0,
    left: -spacing.lg,
    right: -spacing.lg,
    height: 280,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  // The illustration ships with its own rounded card + border baked in,
  // so it renders directly with no extra chrome. 2000×1426 → ratio ≈ 1.4.
  image: {
    width: '100%',
    aspectRatio: 1.403,
  },
  textWrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  titleMuted: {
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  signInRow: {
    alignItems: 'center',
  },
  signInText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 14,
  },
  signInLink: {
    color: colors.accent,
    fontWeight: '600',
  },
});
