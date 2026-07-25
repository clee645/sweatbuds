import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/lib/theme';
import type { Profile, Workout } from '@/types/db';

const MS_PER_DAY = 86_400_000;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type Props = {
  visible: boolean;
  onClose: () => void;
  weekStart: Date;
  weekEnd: Date;
  workouts: Workout[];
  user: Profile | null;
  partner: Profile | null;
};

type DayRow = {
  date: Date;
  isToday: boolean;
  isFuture: boolean;
  userLogged: boolean;
  partnerLogged: boolean;
};

export function ExtendedDaysSheet({
  visible,
  onClose,
  weekStart,
  weekEnd,
  workouts,
  user,
  partner,
}: Props) {
  const insets = useSafeAreaInsets();
  const headerTopPad = Math.max(insets.top, spacing.md);
  const rows = useMemo<DayRow[]>(() => {
    if (!visible) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const dayCount = Math.round((weekEnd.getTime() - weekStart.getTime()) / MS_PER_DAY);

    const userDays = new Set<number>();
    const partnerDays = new Set<number>();
    for (const w of workouts) {
      const t = new Date(w.logged_at);
      if (Number.isNaN(t.getTime())) continue;
      const dayMs = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      if (user && w.user_id === user.id) userDays.add(dayMs);
      else if (partner && w.user_id === partner.id) partnerDays.add(dayMs);
    }

    const out: DayRow[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dMs = d.getTime();
      out.push({
        date: d,
        isToday: dMs === todayMs,
        isFuture: dMs > todayMs,
        userLogged: userDays.has(dMs),
        partnerLogged: partnerDays.has(dMs),
      });
    }
    return out;
  }, [visible, weekStart, weekEnd, workouts, user, partner]);

  const header = useMemo(() => {
    const lastDay = new Date(weekEnd);
    lastDay.setDate(lastDay.getDate() - 1);
    const a = `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
    const b = `${MONTHS_SHORT[lastDay.getMonth()]} ${lastDay.getDate()}`;
    return `${a} – ${b}`;
  }, [weekStart, weekEnd]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.headerRow, { paddingTop: headerTopPad }]}>
          <View style={styles.iconBtn} />
          <View style={styles.titleStack}>
            <Text style={styles.headerTitle}>This Week</Text>
            <Text style={styles.headerSubtitle}>{header}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.date.toISOString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <DayRow row={item} user={user} partner={partner} />}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

function DayRow({
  row,
  user,
  partner,
}: {
  row: DayRow;
  user: Profile | null;
  partner: Profile | null;
}) {
  const dayLabel = DAY_LABELS[row.date.getDay()];
  const dateLabel = `${MONTHS_SHORT[row.date.getMonth()]} ${row.date.getDate()}`;

  return (
    <View style={[styles.row, row.isToday && styles.rowToday]}>
      <View style={styles.dateColumn}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <Text style={[styles.dateLabel, row.isFuture && styles.dateLabelDim]}>
          {dateLabel}
        </Text>
      </View>

      {row.isToday ? (
        <View style={styles.todayPill}>
          <Text style={styles.todayPillText}>Today</Text>
        </View>
      ) : null}

      <View style={styles.markers}>
        {user ? (
          <Marker
            label={user.display_name.charAt(0).toUpperCase() || '?'}
            active={row.userLogged}
          />
        ) : null}
        {partner ? (
          <Marker
            label={partner.display_name.charAt(0).toUpperCase() || '?'}
            active={row.partnerLogged}
          />
        ) : null}
      </View>
    </View>
  );
}

function Marker({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.marker, active ? styles.markerActive : styles.markerInactive]}>
      <Text style={[styles.markerText, active && styles.markerTextActive]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: { alignItems: 'center', gap: 2 },
  headerTitle: { ...typography.bodyStrong, fontSize: 17 },
  headerSubtitle: { ...typography.caption, fontSize: 12 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowToday: {
    backgroundColor: colors.accentSofter,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  dateColumn: { flex: 1, gap: 2 },
  dayLabel: { ...typography.caption, fontSize: 12 },
  dateLabel: { ...typography.bodyStrong, fontSize: 15 },
  dateLabelDim: { color: colors.textMuted, fontWeight: '500' },
  todayPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  todayPillText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  markers: { flexDirection: 'row', gap: spacing.sm },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  markerActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  markerInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  markerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDim,
  },
  markerTextActive: { color: colors.text },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
  },
});
