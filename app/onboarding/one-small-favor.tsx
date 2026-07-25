import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Onboarding screen — a personal note that triggers the App Store rating
// prompt.
export default function OneSmallFavorScreen() {
  const router = useRouter();

  useEffect(() => {
    // Delay the prompt so people can read the note and react first — they're
    // more likely to rate once the message has landed.
    const timer = setTimeout(() => {
      // Best-effort: iOS rate-limits this and it no-ops in Expo Go / simulator.
      (async () => {
        try {
          if (await StoreReview.isAvailableAsync()) {
            await StoreReview.requestReview();
          }
        } catch {
          // Ignore — rating prompt is non-critical.
        }
      })();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.93} />

      <View style={styles.content}>
        <Text style={styles.title}>One small favor</Text>
        <Text style={styles.body}>
          I built Sweatbuds to help me and my gf{'\n'}finally see results
        </Text>
        <Text style={styles.body}>
          we&apos;re a tiny team, every rating genuinely{'\n'}helps
        </Text>

        <Image
          source={require('../../assets/onboarding/founders.png')}
          style={styles.photo}
          contentFit="cover"
        />
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="Continue"
          onPress={() => router.push('/onboarding/save-progress')}
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
    gap: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'center',
  },
  photo: {
    width: 268,
    aspectRatio: 0.916,
    borderRadius: radii.xl,
    marginTop: spacing.xxl,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
