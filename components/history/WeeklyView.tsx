import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { StatCards } from '@/components/history/StatCards';
import { WeekCard } from '@/components/history/WeekCard';
import { useAuth } from '@/lib/auth';
import {
  bucketWorkoutsByPartnershipWeek,
  distinctDaysPerUser,
  partnershipWeekGoalHit,
  type WeekBucket,
} from '@/lib/historyWeek';
import { usePartnership } from '@/lib/partnership';
import { getSignedUrls } from '@/lib/storage';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { getPartnershipWeekStart, partnershipWeekStreak } from '@/lib/week';
import { useWorkouts } from '@/lib/workouts';
import type { Workout } from '@/types/db';

type Props = {
  workouts: Workout[];
  // Reserve space at the bottom for the floating ViewToggle pill so the last
  // WeekCard isn't covered when the user scrolls to the end.
  bottomPad: number;
};

export function WeeklyView({ workouts, bottomPad }: Props) {
  const { user } = useAuth();
  const { partnership, partner, anchorHistory, weekTimezone } = usePartnership();
  const { totalCount } = useWorkouts();
  const userId = user?.id ?? null;
  const partnerId = partner?.id ?? null;
  const target = partnership?.weekly_target ?? 3;

  const buckets = useMemo(
    () => bucketWorkoutsByPartnershipWeek(workouts, partnership, anchorHistory, weekTimezone),
    [workouts, partnership, anchorHistory, weekTimezone],
  );

  // The current week is in-progress and rendered separately on home; History
  // shows only weeks before the partnership's current week.
  const currentWeekStartMs = useMemo(() => {
    const start = getPartnershipWeekStart(partnership, weekTimezone);
    return start ? start.getTime() : 0;
  }, [partnership, weekTimezone]);
  const pastBuckets = useMemo(
    () => buckets.filter((b) => b.weekStart.getTime() < currentWeekStartMs),
    [buckets, currentWeekStartMs],
  );

  const streak = useMemo(
    () =>
      partnershipWeekStreak(
        workouts,
        partnership,
        anchorHistory,
        userId,
        partnerId,
        target,
        weekTimezone,
      ),
    [workouts, partnership, anchorHistory, userId, partnerId, target],
  );

  // Cumulative all-time count for the partnership (both users combined).
  // Falls back to the loaded slice while the HEAD-count query is in flight.
  const total = totalCount ?? workouts.length;

  // Resolve signed URLs for every "earliest selfie per day" once. The storage
  // layer caches in-memory, so toggling between Weekly and Calendar views or
  // re-rendering doesn't refetch.
  const earliestSelfiePaths = useMemo(() => {
    const paths = new Set<string>();
    for (const b of pastBuckets) {
      for (let i = 0; i < 7; i++) {
        const dayWorkouts = b.byDay[i as 0 | 1 | 2 | 3 | 4 | 5 | 6];
        if (dayWorkouts.length === 0) continue;
        let earliest = dayWorkouts[0];
        let earliestMs = +new Date(earliest.logged_at);
        for (let j = 1; j < dayWorkouts.length; j++) {
          const ms = +new Date(dayWorkouts[j].logged_at);
          if (ms < earliestMs) {
            earliest = dayWorkouts[j];
            earliestMs = ms;
          }
        }
        paths.add(earliest.selfie_path);
      }
    }
    return Array.from(paths);
  }, [pastBuckets]);

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

  if (pastBuckets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.statsWrap}>
          <StatCards streak={streak} total={total} />
        </View>
        <Text style={styles.sectionHeading}>Past Weeks</Text>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="time-outline" size={48} color={colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>No past weeks yet</Text>
          <Text style={styles.emptyBody}>
            Complete your first week to see your history here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={pastBuckets}
      keyExtractor={(b) => String(b.weekStart.getTime())}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
      ListHeaderComponent={
        <>
          <View style={styles.statsWrap}>
            <StatCards streak={streak} total={total} />
          </View>
          <Text style={styles.sectionHeading}>Past Weeks</Text>
        </>
      }
      renderItem={({ item }) => (
        <BucketRow
          bucket={item}
          userId={userId}
          partnerId={partnerId}
          target={target}
          tz={weekTimezone}
          uriMap={uriMap}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BucketRow({
  bucket,
  userId,
  partnerId,
  target,
  tz,
  uriMap,
}: {
  bucket: WeekBucket;
  userId: string | null;
  partnerId: string | null;
  target: number;
  tz: string;
  uriMap: Record<string, string>;
}) {
  const { a } = distinctDaysPerUser(bucket.workouts, userId, partnerId, tz);
  const goalHit = partnershipWeekGoalHit(bucket.workouts, userId, partnerId, target, tz);
  return (
    <WeekCard
      bucket={bucket}
      goalHit={goalHit}
      userDays={a}
      weeklyTarget={target}
      uriMap={uriMap}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.md,
  },
  statsWrap: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    ...typography.title,
    fontSize: 22,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
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
