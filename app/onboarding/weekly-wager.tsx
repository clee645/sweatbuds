import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, gradients, radii, spacing, typography } from '@/lib/theme';

// Onboarding screen 5 — explainer for the weekly wager. Single static card.
export default function WeeklyWagerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.22} />

      <View style={styles.content}>
        <View style={styles.topIcon}>
          <Text style={styles.topIconEmoji}>🍽️</Text>
        </View>

        <LinearGradient
          colors={gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wagerCard}
        >
          <Text style={styles.wagerLabel}>THIS WEEK&apos;S WAGER</Text>
          <Text style={styles.wagerTitle}>1 Dinner</Text>
          <View style={styles.emojiRow}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>😎</Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.9)" />
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>🥺</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Decorative wager hint — not a carousel. */}
        <View style={styles.selectorRow}>
          <View style={styles.selectorBadge}>
            <Text style={styles.selectorEmoji}>🍽️</Text>
          </View>
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <View style={styles.selectorBadge}>
            <Text style={styles.selectorEmoji}>🤝</Text>
          </View>
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Set a fun weekly wager</Text>
          <Text style={styles.subtitle}>
            A fun reward keeps you both motivated.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="Continue"
          onPress={() => router.push('/onboarding/show-up')}
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  topIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconEmoji: {
    fontSize: 22,
  },
  wagerCard: {
    width: '100%',
    borderRadius: radii.xl,
    paddingVertical: spacing.xxxl + spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  wagerLabel: {
    ...typography.micro,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  wagerTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  emojiCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  selectorBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorEmoji: {
    fontSize: 23,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  textWrap: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
