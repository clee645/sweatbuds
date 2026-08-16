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
import { zonedYmd } from '@/lib/zonedTime';
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

  // The current week is shown first, live and in-progress, so the week is
  // visible from the day it starts rather than only once it closes. Everything
  // before it lands under "Past Weeks".
  const currentWeekStartMs = useMemo(() => {
    const start = getPartnershipWeekStart(partnership, weekTimezone);
    return start ? start.getTime() : 0;
  }, [partnership, weekTimezone]);
  const currentBucket = useMemo(() => {
    // Guard on a real window: with no current week there is nothing to label
    // "This Week", and the newest past bucket must not be promoted into it.
    if (!currentWeekStartMs) return null;
    // `buckets` is newest-first, so the first match is the current window.
    return buckets.find((b) => b.weekStart.getTime() >= currentWeekStartMs) ?? null;
  }, [buckets, currentWeekStartMs]);
  const pastBuckets = useMemo(
    () => buckets.filter((b) => b.weekStart.getTime() < currentWeekStartMs),
    [buckets, currentWeekStartMs],
  );

  // Today in the couple's zone — lets the in-progress card tell "hasn't
  // happened yet" apart from "missed".
  const todayYmd = useMemo(() => zonedYmd(new Date(), weekTimezone), [weekTimezone]);

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
  const displayBuckets = useMemo(
    () => (currentBucket ? [currentBucket, ...pastBuckets] : pastBuckets),
    [currentBucket, pastBuckets],
  );

  const earliestSelfiePaths = useMemo(() => {
    const paths = new Set<string>();
    for (const b of displayBuckets) {
      // Walk the bucket's real length — a transition week runs 8-13 days, and
      // a fixed 7 would leave those extra days without a resolved thumbnail.
      for (let i = 0; i < b.byDay.length; i++) {
        const dayWorkouts = b.byDay[i];
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
  }, [displayBuckets]);

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
          {currentBucket ? (
            <View
              style={[
                styles.currentWrap,
                pastBuckets.length === 0 && styles.currentWrapLast,
              ]}
            >
              <Text style={styles.sectionHeading}>This Week</Text>
              <BucketRow
                bucket={currentBucket}
                userId={userId}
                partnerId={partnerId}
                target={target}
                tz={weekTimezone}
                uriMap={uriMap}
                todayYmd={todayYmd}
              />
            </View>
          ) : null}
          {pastBuckets.length > 0 ? (
            <Text style={styles.sectionHeading}>Past Weeks</Text>
          ) : null}
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
      // Only a safety net for the degenerate case where there is no week to
      // show at all. Once the in-progress week renders, a "no history yet"
      // placeholder beneath it would contradict the card above it.
      ListEmptyComponent={
        currentBucket ? null : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="time-outline" size={48} color={colors.textDim} />
            </View>
            <Text style={styles.emptyTitle}>No weeks yet</Text>
            <Text style={styles.emptyBody}>
              Log your first workout to start building your history
            </Text>
          </View>
        )
      }
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
  todayYmd,
}: {
  bucket: WeekBucket;
  userId: string | null;
  partnerId: string | null;
  target: number;
  tz: string;
  uriMap: Record<string, string>;
  // Set only for the in-progress week. See WeekCard's prop docs.
  todayYmd?: string;
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
      todayYmd={todayYmd}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.md,
  },
  statsWrap: {
    marginBottom: spacing.xl,
  },
  currentWrap: {
    marginBottom: spacing.xl,
  },
  // No "Past Weeks" section below, so drop the gap that would separate them.
  currentWrapLast: {
    marginBottom: 0,
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
