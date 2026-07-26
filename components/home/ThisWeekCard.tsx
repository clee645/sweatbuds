import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { usePartnership } from '@/lib/partnership';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { DEFAULT_WEEK_START_DAY, type WeekWindow } from '@/lib/week';
import { zonedDayOfWeek } from '@/lib/zonedTime';
import type { WeekProgress, Workout } from '@/types/db';
import { ExtendedDaysSheet } from './ExtendedDaysSheet';
import { WeekDots } from './WeekDots';

const MS_PER_DAY = 86_400_000;

type Props = {
  userWeek: WeekProgress;
  partnerWeek: WeekProgress | null;
  // Optional: when provided, drives the days-left badge, extended-week
  // banner, and the +N overflow pill. Callers like the post-log success
  // screen pass nothing and get a plain card.
  weekWindow?: WeekWindow;
  workouts?: Workout[];
  partnerId?: string | null;
  onInvitePartner?: () => void;
  hideInviteSlot?: boolean;
  // `solo` is the post-log success-screen variant: strips the days-left pill
  // and the extended-week banner so the card is a quiet summary of just the
  // user's progress, not the partnership's full state.
  variant?: 'default' | 'solo';
};

function daysLeftLabel(weekEnd: Date, now: Date = new Date()): string {
  const diffMs = weekEnd.getTime() - now.getTime();
  if (diffMs <= 60 * 60 * 1000) return 'Last day';
  if (diffMs < MS_PER_DAY) return 'Ends today';
  const days = Math.ceil(diffMs / MS_PER_DAY);
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function ThisWeekCard({
  userWeek,
  partnerWeek,
  weekWindow,
  workouts,
  partnerId,
  onInvitePartner,
  hideInviteSlot,
  variant = 'default',
}: Props) {
  const showInvite = !partnerWeek && !hideInviteSlot;
  const solo = variant === 'solo';
  const [sheetOpen, setSheetOpen] = useState(false);
  const { profile, user } = useAuth();
  const { partner, weekTimezone } = usePartnership();

  // Falls back to the shared default rather than a bare `3` (Wednesday), which
  // used to disagree with getSoloWeekWindow's own hardcoded default.
  const weekStartDay = weekWindow
    ? zonedDayOfWeek(weekWindow.startYmd)
    : DEFAULT_WEEK_START_DAY;
  const extraDays = weekWindow ? Math.max(0, weekWindow.dayCount - 7) : 0;
  const daysLeftText = weekWindow ? daysLeftLabel(weekWindow.weekEnd) : null;

  const profileForSheet =
    profile ??
    (user
      ? {
          id: user.id,
          display_name: 'You',
          avatar_url: null,
          created_at: '',
          timezone: null,
          timezone_set_by_user: false,
          is_pro: false,
        }
      : null);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>This Week</Text>
        {daysLeftText && !solo ? (
          <View style={styles.daysLeftPill}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={styles.daysLeftText}>{daysLeftText}</Text>
          </View>
        ) : null}
      </View>

      {weekWindow?.isExtendedWeek && !solo ? (
        <View style={styles.banner}>
          <Ionicons name="calendar-outline" size={14} color={colors.warning} />
          <Text
            style={styles.bannerText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            Week start day updated. This week will run longer.
          </Text>
        </View>
      ) : null}

      <View style={styles.rowsRow}>
        <UserSlot
          week={userWeek}
          weekStartDay={weekStartDay}
          extraDays={extraDays}
          onPressOverflow={extraDays > 0 ? () => setSheetOpen(true) : undefined}
        />
        {partnerWeek ? (
          <UserSlot
            week={partnerWeek}
            weekStartDay={weekStartDay}
            extraDays={extraDays}
            onPressOverflow={extraDays > 0 ? () => setSheetOpen(true) : undefined}
          />
        ) : null}
        {showInvite ? (
          <Pressable style={styles.inviteSlot} onPress={onInvitePartner}>
            <Text style={styles.inviteSlotText}>Invite your partner</Text>
            <View style={styles.invitePlus}>
              <Ionicons name="add" size={18} color={colors.text} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {extraDays > 0 && weekWindow ? (
        <ExtendedDaysSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          startYmd={weekWindow.startYmd}
          endYmd={weekWindow.endYmd}
          tz={weekTimezone}
          workouts={workouts ?? []}
          user={profileForSheet}
          partner={partnerId ? partner : null}
        />
      ) : null}
    </View>
  );
}

function UserSlot({
  week,
  weekStartDay,
  extraDays,
  onPressOverflow,
}: {
  week: WeekProgress;
  weekStartDay: number;
  extraDays: number;
  onPressOverflow?: () => void;
}) {
  const isComplete = week.workoutsThisWeek >= week.target;
  return (
    <View style={[styles.userSlot, isComplete && styles.userSlotComplete]}>
      <View style={styles.userHeader}>
        <View style={styles.nameWrap}>
          {isComplete && (
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          )}
          <Text style={styles.userName} numberOfLines={1}>
            {week.user.display_name}
          </Text>
        </View>
        <View style={[styles.countPill, isComplete && styles.countPillComplete]}>
          <Text style={[styles.countPillText, isComplete && styles.countPillTextComplete]}>
            {isComplete ? '🎉 ' : ''}{week.workoutsThisWeek}/{week.target}
          </Text>
        </View>
      </View>
      <View style={styles.dotsWrap}>
        <WeekDots
          completed={week.completedDays}
          weekStartDay={weekStartDay}
          extraDays={extraDays}
          onPressOverflow={onPressOverflow}
          size={22}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  daysLeftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
  },
  daysLeftText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.30)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginTop: spacing.xs,
  },
  bannerText: {
    flex: 1,
    ...typography.caption,
    fontSize: 11,
    color: colors.text,
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
    gap: spacing.md,
    justifyContent: 'flex-start',
  },
  userSlotComplete: {
    backgroundColor: colors.accentSofter,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
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
  countPillComplete: {
    backgroundColor: colors.accentSoft,
  },
  countPillText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  countPillTextComplete: {
    color: colors.accent,
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
