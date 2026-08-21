import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { PhoneFrame, STEP_LAYOUTS } from '@/components/widget/WidgetMockups';
import { WidgetStepCaption } from '@/components/widget/WidgetStepCaption';
import { WidgetStepDots } from '@/components/widget/WidgetStepDots';
import { setWidgetSetupSeen } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

// Leaves the walkthrough for the home screen. Recorded so a later trip through
// the paywall flow doesn't drag the user back through these screens.
export async function finishWidgetSetup(): Promise<void> {
  await setWidgetSetupSeen();
  router.replace('/');
}

type Props = {
  // Zero-based walkthrough step; picks the mockup, the caption and the dot.
  step: number;
  ctaLabel: string;
  onNext: () => void;
  showBack?: boolean;
};

// One click-through step of the post-purchase widget walkthrough. The Settings
// version of the same content is a swipe pager; here each step is its own route.
export function WidgetStepScreen({ step, ctaLabel, onNext, showBack = true }: Props) {
  const Layout = STEP_LAYOUTS[step];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <Text style={styles.title}>Add the widget to{'\n'}your home screen</Text>

      <View style={styles.stage}>
        <PhoneFrame tilted={step === 0}>
          <Layout />
        </PhoneFrame>
      </View>

      <View style={styles.captionRow}>
        <WidgetStepCaption step={step} />
      </View>

      <WidgetStepDots page={step} />

      <View style={styles.footer}>
        <OnboardingButton variant="primary" label={ctaLabel} onPress={onNext} />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  pressed: { opacity: 0.5 },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionRow: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
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
