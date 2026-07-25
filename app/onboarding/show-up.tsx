import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Onboarding screen 6 — accountability pitch. Static preview.
export default function ShowUpScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.29} />

      <View style={styles.content}>
        <Image
          source={require('../../assets/onboarding/partner.png')}
          style={styles.photo}
          contentFit="contain"
        />

        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekTitle}>This Week</Text>
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>🔥 3-week streak</Text>
            </View>
          </View>
          <ProgressRow initials="ME" tint="#6366F1" label="You" />
          <ProgressRow initials="PA" tint={colors.accent} label="Partner" />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>See each other show up</Text>
          <Text style={styles.subtitle}>
            Consistency gets easier when{'\n'}you&apos;re not alone.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="Continue"
          onPress={() => router.push('/onboarding/stay-strong')}
        />
      </View>
    </SafeAreaView>
  );
}

function ProgressRow({
  initials,
  tint,
  label,
}: {
  initials: string;
  tint: string;
  label: string;
}) {
  return (
    <View style={styles.progressRow}>
      <View style={[styles.avatar, { backgroundColor: tint }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowCount}>3/3</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={styles.barFill} />
        </View>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  // The partner photo ships as a fully composed graphic (stacked cards,
  // "Partner"/"Sat" badges, particles). 1494×2000 → ratio ≈ 0.747.
  photo: {
    width: 196,
    aspectRatio: 0.747,
    marginTop: -spacing.xxl,
  },
  weekCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  streakPill: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  streakText: {
    ...typography.micro,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rowBody: {
    flex: 1,
    gap: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    ...typography.caption,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  barTrack: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.borderSoft,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  rowCount: {
    ...typography.caption,
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  textWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
