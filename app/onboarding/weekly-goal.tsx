import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, radii, spacing, typography } from '@/lib/theme';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Illustrative completed-day patterns — static, not editable.
const YOU = [true, false, true, true, false, false, false]; // Mon / Wed / Thu
const PARTNER = [true, false, false, true, false, true, false]; // Mon / Thu / Sat

// Onboarding screen 4 — explainer for the shared weekly goal. Static preview.
export default function WeeklyGoalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.14} />

      <View style={styles.content}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>
            Set a weekly goal{'\n'}together
          </Text>
          <Text style={styles.subtitle}>
            Choose how many days you&apos;ll work out a week.
          </Text>
        </View>

        <View style={styles.cardRegion}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.labelCol} />
              {DAYS.map((d, i) => (
                <Text key={i} style={styles.dayLabel}>
                  {d}
                </Text>
              ))}
            </View>
            <DayRow label="You" days={YOU} />
            <DayRow label="Partner" days={PARTNER} />
            <Text style={styles.caption}>
              Your progress updates every time{'\n'}you log a workout.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="Continue"
          onPress={() => router.push('/onboarding/weekly-wager')}
        />
      </View>
    </SafeAreaView>
  );
}

function DayRow({ label, days }: { label: string; days: boolean[] }) {
  return (
    <View style={styles.dayRow}>
      <Text style={[styles.labelCol, styles.rowLabel]}>{label}</Text>
      {days.map((active, i) => (
        <View key={i} style={styles.slot}>
          {active ? (
            <View style={styles.check}>
              <Ionicons name="checkmark" size={18} color={colors.text} />
            </View>
          ) : (
            <View style={styles.dot} />
          )}
        </View>
      ))}
    </View>
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
  textWrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 23,
  },
  cardRegion: {
    flex: 1,
    justifyContent: 'flex-start',
    marginTop: spacing.xxxl + spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxxl,
    gap: spacing.xxl,
    // Reddish glow behind the card.
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  labelCol: {
    width: 60,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    ...typography.micro,
    fontSize: 12,
    color: colors.textDim,
  },
  slot: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#00C950',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle green glow.
    shadowColor: '#39FF14',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.textDim,
  },
  caption: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
