import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';
import { formatWager, type WagerRule } from '@/lib/wagers';

type Props = {
  days: number;
  wager: WagerRule;
  onPressInfo?: () => void;
};

export function StakesCard({ days, wager, onPressInfo }: Props) {
  const body = `Work out ${days}+ days this week or owe ${formatWager(wager)}.`;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleEmoji}>🎯</Text>
          <Text style={styles.title}>The Stakes</Text>
        </View>
        <Pressable onPress={onPressInfo} hitSlop={8}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleEmoji: {
    fontSize: 16,
  },
  title: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
