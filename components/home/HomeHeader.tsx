import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  workoutCount: number;
  streak: number;
  hasPartner: boolean;
  onOpenDrawer: () => void;
  onPressInvite: () => void;
  onLongPress?: () => void;
};

export function HomeHeader({
  workoutCount,
  streak,
  hasPartner,
  onOpenDrawer,
  onPressInvite,
  onLongPress,
}: Props) {
  // Once paired, always show the count badge — including 0. The "Invite
  // Partner" CTA is only meaningful before a partnership exists.
  const showCountPill = hasPartner || workoutCount > 0;
  const showStreakPill = streak > 0;

  return (
    <View style={styles.row} onTouchEnd={undefined}>
      <Pressable
        onPress={onOpenDrawer}
        onLongPress={onLongPress}
        delayLongPress={500}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="menu" size={22} color={colors.text} />
      </Pressable>

      {showStreakPill ? (
        <View style={styles.workoutsPill}>
          <Text style={styles.workoutsPillEmoji}>🔥</Text>
          <Text style={styles.workoutsPillText}>
            <Text style={styles.workoutsPillCount}>{streak}</Text>{' '}
            {streak === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
      ) : showCountPill ? (
        <View style={styles.workoutsPill}>
          <Text style={styles.workoutsPillEmoji}>💪</Text>
          <Text style={styles.workoutsPillText}>
            <Text style={styles.workoutsPillCount}>{workoutCount}</Text>{' '}
            {workoutCount === 1 ? 'Workout' : 'Workouts'}
          </Text>
        </View>
      ) : (
        <Pressable style={styles.invitePill} onPress={onPressInvite} hitSlop={6}>
          <Ionicons name="person-add-outline" size={14} color={colors.accent} />
          <Text style={styles.invitePillText}>Invite Partner</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  invitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    backgroundColor: colors.accentSoft,
  },
  invitePillText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  workoutsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 95, 0.16)',
    backgroundColor: 'rgba(255, 90, 95, 0.06)',
  },
  workoutsPillEmoji: {
    fontSize: 13,
    color: colors.accent,
  },
  workoutsPillText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  workoutsPillCount: {
    color: colors.accent,
  },
});
