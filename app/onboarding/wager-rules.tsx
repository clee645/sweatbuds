import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, radii, spacing, typography } from '@/lib/theme';

const GREEN = '#00C950';
const RED = '#EF4444';

type Outcome = 'win' | 'loss';

// Onboarding setup screen — explains the weekly wager rules. Comes right after
// the workout-days picker.
export default function WagerRulesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.5} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>How your weekly{'\n'}wager works</Text>
        <Text style={styles.subtitle}>
          It&apos;s simple — whoever falls short pays the weekly reward.
        </Text>

        <View style={styles.cards}>
          <RuleCard
            title="Both hit your goal"
            caption="No one pays."
            captionColor={GREEN}
            you="win"
            partner="win"
          />
          <RuleCard
            title="Only one falls short"
            caption="Whoever falls short owes 1 reward."
            captionColor={colors.accent}
            you="loss"
            partner="win"
          />
          <RuleCard
            title="Both fall short"
            caption="No one pays."
            captionColor={colors.textMuted}
            you="loss"
            partner="loss"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton
          label="Set your wager"
          onPress={() => router.push('/onboarding/wager-select')}
        />
      </View>
    </SafeAreaView>
  );
}

function RuleCard({
  title,
  caption,
  captionColor,
  you,
  partner,
}: {
  title: string;
  caption: string;
  captionColor: string;
  you: Outcome;
  partner: Outcome;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.cardCaption, { color: captionColor }]}>{caption}</Text>
      </View>
      <View style={styles.badges}>
        <Badge outcome={you} label="YOU" />
        <Badge outcome={partner} label="PARTNER" />
      </View>
    </View>
  );
}

function Badge({ outcome, label }: { outcome: Outcome; label: string }) {
  const win = outcome === 'win';
  return (
    <View style={styles.badgeCol}>
      <View
        style={[
          styles.badgeRing,
          { backgroundColor: win ? 'rgba(0,201,80,0.32)' : 'rgba(239,68,68,0.32)' },
        ]}
      >
        <View
          style={[
            styles.badgeCircle,
            { backgroundColor: win ? GREEN : RED },
            win ? styles.glowGreen : styles.glowRed,
          ]}
        >
          <Ionicons
            name={win ? 'checkmark' : 'close'}
            size={28}
            color={win ? '#0A0A0A' : '#FFFFFF'}
          />
        </View>
      </View>
      <Text style={styles.badgeLabel}>{label}</Text>
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
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  cards: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyStrong,
    fontSize: 21,
    fontWeight: '700',
  },
  cardCaption: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  badgeCol: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowGreen: {
    shadowColor: GREEN,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  glowRed: {
    shadowColor: RED,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  badgeLabel: {
    ...typography.micro,
    fontSize: 11,
    color: colors.textDim,
    letterSpacing: 0.8,
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
