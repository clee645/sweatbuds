import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Onboarding screen 7 — the exit screen. Each CTA branches into its own setup
// flow; onboarding is marked complete at the end of those sub-flows.
export default function StayStrongScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.36} />

      <View style={styles.content}>
        <View style={styles.imageCard}>
          <Image
            source={require('../../assets/onboarding/stay-strong.png')}
            style={styles.image}
            contentFit="cover"
          />
        </View>

        <Text style={styles.eyebrow}>With Sweatbuds</Text>

        <View style={styles.spacer} />

        <Text style={styles.title}>
          You both start strong…{'\n'}
          <Text style={styles.titleAccent}>then stay strong.</Text>
        </Text>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="My partner sent me a code"
          variant="secondary"
          onPress={() => router.push('/onboarding/invite-code')}
        />
        <OnboardingButton
          label="Set up weekly plan"
          onPress={() => router.push('/onboarding/weekly-plan')}
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
  },
  // Illustration is a plain 2000×1285 rectangle (ratio ≈ 1.556); the card
  // gives it rounded corners. Sits high, just under the header.
  imageCard: {
    width: '100%',
    aspectRatio: 1.556,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginTop: spacing.xl,
  },
  // Flexible gap that pushes the title down toward the buttons.
  spacer: {
    flex: 1,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },
  titleAccent: {
    color: colors.accent,
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
});
