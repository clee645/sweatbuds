import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/lib/theme';

type BadgeKind = 'check' | 'cross';

function OutcomeBadge({ kind, label }: { kind: BadgeKind; label: string }) {
  const isCheck = kind === 'check';
  return (
    <View style={styles.badgeWrap}>
      <View
        style={[
          styles.badgeRing,
          { backgroundColor: isCheck ? colors.successSoft : colors.dangerSoft },
        ]}
      >
        <View
          style={[
            styles.badgeInner,
            { backgroundColor: isCheck ? colors.success : colors.danger },
          ]}
        >
          <Ionicons
            name={isCheck ? 'checkmark' : 'close'}
            size={22}
            color={isCheck ? '#000000' : colors.text}
          />
        </View>
      </View>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

type OutcomeCardProps = {
  title: string;
  body: string;
  bodyColor: string;
  you: BadgeKind;
  partner: BadgeKind;
};

function OutcomeCard({ title, body, bodyColor, you, partner }: OutcomeCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.cardBody, { color: bodyColor }]}>{body}</Text>
      </View>
      <View style={styles.badgeRow}>
        <OutcomeBadge kind={you} label="YOU" />
        <OutcomeBadge kind={partner} label="PARTNER" />
      </View>
    </View>
  );
}

export default function WagerInfoScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>How your weekly{'\n'}wager works</Text>
        <Text style={styles.subtitle}>
          It&apos;s simple — whoever falls short pays the weekly reward.
        </Text>
      </View>

      <View style={styles.cards}>
        <OutcomeCard
          title="Both hit your goal"
          body="No one pays."
          bodyColor={colors.success}
          you="check"
          partner="check"
        />
        <OutcomeCard
          title="Only one falls short"
          body="Whoever falls short owes 1 reward."
          bodyColor={colors.warning}
          you="cross"
          partner="check"
        />
        <OutcomeCard
          title="Both fall short"
          body="No one pays."
          bodyColor={colors.textMuted}
          you="cross"
          partner="cross"
        />
      </View>

      <View style={styles.spacer} />

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.gotItBtn, pressed && styles.gotItPressed]}
      >
        <Text style={styles.gotItLabel}>Got it</Text>
      </Pressable>
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
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  cards: {
    gap: spacing.md,
    marginTop: spacing.xxxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  badgeWrap: {
    alignItems: 'center',
  },
  badgeRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    ...typography.micro,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  spacer: { flex: 1 },
  gotItBtn: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  gotItPressed: { opacity: 0.9 },
  gotItLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
});
