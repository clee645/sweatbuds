import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsistencyChart } from '@/components/onboarding/ConsistencyChart';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Onboarding screen 3 — long-term consistency pitch with a chart.
export default function ConsistencyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.07} />

      <View style={styles.content}>
        <Text style={styles.title}>
          Sweatbuds creates{'\n'}
          <Text style={styles.titleAccent}>long-term consistency</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Your consistency</Text>
          <ConsistencyChart />
        </View>

        <View style={styles.statWrap}>
          <Text style={styles.statAccent}>90% of couples</Text>
          <Text style={styles.stat}>
            using Sweatbuds maintain their workout streak after 3 months.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="See how it works"
          onPress={() => router.push('/onboarding/weekly-goal')}
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
    gap: spacing.xxl,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '700',
  },
  titleAccent: {
    color: colors.accent,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeading: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  statWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stat: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 28,
  },
  statAccent: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 19,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
