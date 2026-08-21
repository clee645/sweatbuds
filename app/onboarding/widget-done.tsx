import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { PhoneFrame, SuccessLayout } from '@/components/widget/WidgetMockups';
import { mutedCaption } from '@/components/widget/WidgetStepCaption';
import { finishWidgetSetup } from '@/components/widget/WidgetStepScreen';
import { colors, spacing, typography } from '@/lib/theme';

// Widget walkthrough, final screen — mirrors the Settings success state.
export default function WidgetDoneScreen() {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Your widget is set up</Text>
        <PhoneFrame glowing>
          <SuccessLayout />
        </PhoneFrame>
        <Text style={styles.caption}>
          Their last workout,{'\n'}every time you unlock your phone
        </Text>
      </View>

      <View style={styles.footer}>
        <OnboardingButton variant="primary" label="Finish" onPress={finishWidgetSetup} />
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
    gap: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  caption: mutedCaption,
  footer: {
    paddingBottom: spacing.lg,
  },
});
