import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { MonthGrid } from '@/components/history/MonthGrid';
import { bucketWorkoutsByDay } from '@/lib/historyWeek';
import { usePartnership } from '@/lib/partnership';
import { getSignedUrls } from '@/lib/storage';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { getPairedAnchor } from '@/lib/week';
import { zonedYmd } from '@/lib/zonedTime';
import type { Workout } from '@/types/db';

type Props = {
  workouts: Workout[];
  bottomPad: number;
};

type MonthEntry = { year: number; month: number };

export function CalendarView({ workouts, bottomPad }: Props) {
  const { partnership, weekTimezone } = usePartnership();

  // Couple's calendar shows only days from `paired_at` forward; pre-pair
  // workouts stay in the user's personal record but don't belong on the
  // shared memories surface. The fetch is already partnership-scoped, but
  // this cutoff is defense-in-depth.
  const coupleWorkouts = useMemo(() => {
    const anchor = getPairedAnchor(partnership, weekTimezone);
    if (!anchor) return workouts;
    const anchorMs = anchor.getTime();
    return workouts.filter((w) => {
      const t = new Date(w.logged_at).getTime();
      return !Number.isNaN(t) && t >= anchorMs;
    });
  }, [workouts, partnership, weekTimezone]);

  const byDay = useMemo(
    () => bucketWorkoutsByDay(coupleWorkouts, weekTimezone),
    [coupleWorkouts, weekTimezone],
  );

  // Months from the very first workout's month → current month, chronological
  // (earliest at top). If no workouts ever, just render the current month
  // with all-muted cells so the empty calendar still feels like a real surface.
  const months = useMemo<MonthEntry[]>(() => {
    // Resolved in the couple's zone so the month headers agree with the day
    // cells beneath them, which are keyed the same way.
    const nowYmd = zonedYmd(new Date(), weekTimezone);
    const currentY = Number(nowYmd.slice(0, 4));
    const currentM = Number(nowYmd.slice(5, 7)) - 1;
    if (coupleWorkouts.length === 0) {
      return [{ year: currentY, month: currentM }];
    }
    const earliestYmd = zonedYmd(
      coupleWorkouts[coupleWorkouts.length - 1].logged_at,
      weekTimezone,
    );
    const earliestY = Number(earliestYmd.slice(0, 4));
    const earliestM = Number(earliestYmd.slice(5, 7)) - 1;
    const list: MonthEntry[] = [];
    let y = earliestY;
    let m = earliestM;
    while (y < currentY || (y === currentY && m <= currentM)) {
      list.push({ year: y, month: m });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return list;
  }, [coupleWorkouts, weekTimezone]);

  // Resolve signed URLs for the earliest selfie of every day. One batch up
  // front, then the storage cache feeds month-by-month renders for free.
  const earliestSelfiePaths = useMemo(() => {
    const paths: string[] = [];
    for (const iso of Object.keys(byDay)) {
      const arr = byDay[iso];
      if (arr.length === 0) continue;
      paths.push(arr[0].selfie_path);
    }
    return paths;
  }, [byDay]);

  const [uriMap, setUriMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    if (earliestSelfiePaths.length === 0) {
      setUriMap({});
      return;
    }
    getSignedUrls(earliestSelfiePaths).then((map) => {
      if (!cancelled) setUriMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [earliestSelfiePaths]);

  if (coupleWorkouts.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="calendar-outline" size={48} color={colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyBody}>
            Log a workout to start filling your shared calendar
          </Text>
        </View>
        <MonthGrid
          year={months[0].year}
          month={months[0].month}
          byDay={byDay}
          uriMap={uriMap}
        />
        <View style={{ height: bottomPad }} />
      </View>
    );
  }

  return (
    <FlatList
      data={months}
      keyExtractor={(m) => `${m.year}-${m.month}`}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
      renderItem={({ item }) => (
        <MonthGrid
          year={item.year}
          month={item.month}
          byDay={byDay}
          uriMap={uriMap}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: spacing.md,
  },
  emptyWrap: {
    flex: 1,
    paddingTop: spacing.md,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIconWrap: {
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
  },
});
