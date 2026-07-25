import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayWheelPicker } from '@/components/onboarding/DayWheelPicker';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { setPendingWorkoutDays } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding setup screen — entered from stay-strong's "Set up weekly plan".
export default function WeeklyPlanScreen() {
  const router = useRouter();
  const [days, setDays] = useState(3);

  const handleContinue = async () => {
    await setPendingWorkoutDays(days);
    router.push('/onboarding/wager-rules');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.43} />

      <View style={styles.content}>
        <Text style={styles.title}>
          How many days do you want to work out each week?
        </Text>

        <View style={styles.wheelWrap}>
          <DayWheelPicker value={days} onChange={setDays} />
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton label="Continue" variant="accent" onPress={handleContinue} />
        <Text style={styles.caption}>You can change this later</Text>
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
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  wheelWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  caption: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 13,
  },
});
