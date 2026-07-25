import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  streak: number;
  total: number;
};

export function StatCards({ streak, total }: Props) {
  const streakActive = streak > 0;
  return (
    <View style={styles.row}>
      <View
        style={[styles.card, streakActive ? styles.streakActive : styles.cardInactive]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.icon}>🔥</Text>
          <Text style={[styles.label, streakActive && styles.labelActive]}>STREAK</Text>
        </View>
        <Text style={styles.bigNumber}>{streak}</Text>
        <Text style={styles.unit}>Weeks goal hit</Text>
      </View>

      <View style={[styles.card, styles.cardInactive]}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>🏆</Text>
          <Text style={styles.label}>TOTAL</Text>
        </View>
        <Text style={styles.bigNumber}>{total}</Text>
        <Text style={styles.unit}>Workouts logged</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  card: {
    flex: 1,
    minHeight: 150,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  cardInactive: {
    backgroundColor: colors.cardElevated,
    borderColor: 'transparent',
  },
  streakActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.55)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    ...typography.micro,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.warning,
  },
  bigNumber: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  unit: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});
