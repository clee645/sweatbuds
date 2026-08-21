import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { PhoneFrame, SuccessLayout } from '@/components/widget/WidgetMockups';
import { finishWidgetSetup } from '@/components/widget/WidgetStepScreen';
import { colors, spacing, typography } from '@/lib/theme';

// Widget walkthrough, screen 1 — the pitch. Entered with `replace` from
// paywall-success, so there is deliberately nothing to go back to.
export default function WidgetIntroScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <PhoneFrame glowing>
          <SuccessLayout />
        </PhoneFrame>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Keep your partner on{'\n'}your home screen</Text>
          <Text style={styles.subtitle}>
            The Sweatbuds widget shows their last workout without you opening the app
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          variant="primary"
          label="Set up my widget"
          onPress={() => router.push('/onboarding/widget-step-1')}
        />
        <Pressable onPress={finishWidgetSetup} hitSlop={8}>
          <Text style={styles.skip}>Skip for now</Text>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
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
    gap: spacing.md,
  },
  skip: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
