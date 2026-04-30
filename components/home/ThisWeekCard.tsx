import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';
import type { WeekProgress } from '@/types/db';
import { WeekDots } from './WeekDots';

type Props = {
  userWeek: WeekProgress;
  partnerWeek: WeekProgress | null;
  onInvitePartner: () => void;
};

export function ThisWeekCard({ userWeek, partnerWeek, onInvitePartner }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>This Week</Text>

      <View style={styles.rowsRow}>
        <UserSlot week={userWeek} />
        {partnerWeek ? (
          <UserSlot week={partnerWeek} />
        ) : (
          <Pressable style={styles.inviteSlot} onPress={onInvitePartner}>
            <Text style={styles.inviteSlotText}>Invite your partner</Text>
            <View style={styles.invitePlus}>
              <Ionicons name="add" size={18} color={colors.text} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function UserSlot({ week }: { week: WeekProgress }) {
  return (
    <View style={styles.userSlot}>
      <View style={styles.userHeader}>
        <Text style={styles.userName} numberOfLines={1}>
          {week.user.display_name}
        </Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {week.workoutsThisWeek}/{week.target}
          </Text>
        </View>
      </View>
      <View style={styles.dotsWrap}>
        <WeekDots completed={week.completedDays} size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  dotsWrap: {
    alignSelf: 'center',
  },
  heading: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  rowsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  userSlot: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  userName: {
    ...typography.bodyStrong,
    color: colors.text,
    fontSize: 13,
  },
  countPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.cardElevated,
  },
  countPillText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  inviteSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBorderSoft,
    backgroundColor: colors.accentSofter,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  inviteSlotText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  invitePlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
