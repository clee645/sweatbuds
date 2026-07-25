import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, gradients, spacing } from '@/lib/theme';

type Plan = 'monthly' | 'yearly';

type Step = {
  renderIcon: (color: string) => ReactNode;
  title: string;
  subtitle: string;
};

const ICON_SIZE = 19;

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildSteps(plan: Plan): Step[] {
  const trialDays = plan === 'yearly' ? 7 : 0;
  const reminderDays = plan === 'yearly' ? 5 : 0;
  const billingDate = new Date();
  billingDate.setDate(billingDate.getDate() + trialDays);

  const chargeLine =
    plan === 'yearly'
      ? `You'll be charged on ${formatDate(billingDate)} unless you cancel anytime before.`
      : `You'll be charged today unless you cancel anytime before.`;

  return [
    {
      renderIcon: (c) => <Ionicons name="lock-open" size={ICON_SIZE} color={c} />,
      title: 'Today',
      subtitle: 'Unlock full access for you and your partner.',
    },
    {
      renderIcon: (c) => <Ionicons name="notifications" size={ICON_SIZE} color={c} />,
      title: `${reminderDays === 0 ? '0 Day' : `In ${reminderDays} Days`} - Reminder`,
      subtitle: "We'll send you a reminder that your trial is ending soon.",
    },
    {
      renderIcon: (c) => <MaterialCommunityIcons name="crown" size={ICON_SIZE} color={c} />,
      title: `In ${trialDays} Days - Billing Starts`,
      subtitle: chargeLine,
    },
  ];
}

// Vertical 3-step trial timeline shown on the paywall. The first step's badge is
// a filled red gradient; the rest are red-outlined rings. Step labels shift
// depending on whether the monthly or yearly (7-day-trial) plan is selected.
export function TrialTimeline({ plan }: { plan: Plan }) {
  const steps = buildSteps(plan);

  return (
    <View style={styles.wrap}>
      {steps.map((step, i) => {
        const filled = i === 0;
        return (
          <View key={i} style={styles.row}>
            <View style={styles.rail}>
              {filled ? (
                <LinearGradient
                  colors={gradients.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconCircle}
                >
                  {step.renderIcon(colors.bg)}
                </LinearGradient>
              ) : (
                <View style={[styles.iconCircle, styles.iconCircleOutlined]}>
                  {step.renderIcon(colors.orange)}
                </View>
              )}
              <LinearGradient
                colors={['rgba(255, 90, 95, 0.55)', 'rgba(255, 90, 95, 0.12)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={i < steps.length - 1 ? styles.line : styles.lineLast}
              />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.subtitle}>{step.subtitle}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    width: 44,
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.orange,
  },
  line: {
    flex: 1,
    width: 9,
    borderRadius: 4.5,
    marginVertical: spacing.xs,
  },
  // Short stub below the final (crown) icon — ends roughly level with the
  // last step's subtitle text.
  lineLast: {
    width: 9,
    height: 38,
    borderRadius: 4.5,
    marginTop: spacing.xs,
  },
  textCol: {
    flex: 1,
    paddingBottom: 24,
    paddingTop: spacing.xs,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
});
