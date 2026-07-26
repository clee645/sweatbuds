import { StyleSheet, Text, View } from 'react-native';

import { DayThumbnail } from '@/components/history/DayThumbnail';
import { formatWeekRange, type WeekBucket } from '@/lib/historyWeek';
import { addZonedDays, zonedDayOfWeek, zonedMonthDay } from '@/lib/zonedTime';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { Workout } from '@/types/db';

// Indexed by JS getDay(): Sun=0..Sat=6.
const JS_DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

type Props = {
  bucket: WeekBucket;
  goalHit: boolean;
  // Current user's distinct workout-day count for this week (capped at target).
  userDays: number;
  // partnership.weekly_target — per-partner target.
  weeklyTarget: number;
  // Map of selfie storage path -> signed URL, pre-resolved by the parent so
  // every WeekCard reads from one shared cache.
  uriMap: Record<string, string>;
};

export function WeekCard({ bucket, goalHit, userDays, weeklyTarget, uriMap }: Props) {
  const range = formatWeekRange(bucket.startYmd, bucket.endYmd);
  const displayDays = Math.min(userDays, weeklyTarget);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.range}>{range}</Text>
          <Text style={styles.subtitle}>
            {displayDays} of {weeklyTarget} goal hit
          </Text>
        </View>
        {goalHit ? (
          <View style={styles.goalHitPill}>
            <Text style={styles.goalHitText}>GOAL HIT</Text>
            <Text style={styles.goalHitFire}>🔥</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.daysCol}>
        {chunkRows(bucket.dayCount).map((row, rowIdx) => (
          <View key={rowIdx} style={styles.daysRow}>
            {row.map((i) => {
              const dayYmd = addZonedDays(bucket.startYmd, i);
              const letter = JS_DAY_LETTERS[zonedDayOfWeek(dayYmd)];
              const dayWorkouts = bucket.byDay[i];
              const earliest = pickEarliest(dayWorkouts);
              const uri = earliest ? (uriMap[earliest.selfie_path] ?? null) : null;
              return (
                <DayThumbnail
                  key={`${bucket.startYmd}-${i}`}
                  letter={letter}
                  dayNumber={zonedMonthDay(dayYmd).day}
                  imageUri={uri}
                />
              );
            })}
            {Array.from({ length: 7 - row.length }).map((_, k) => (
              <View key={`pad-${rowIdx}-${k}`} style={styles.padCell} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function chunkRows(dayCount: number): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < dayCount; i += 7) {
    const row: number[] = [];
    for (let j = i; j < Math.min(i + 7, dayCount); j++) row.push(j);
    rows.push(row);
  }
  return rows;
}

function pickEarliest(workouts: Workout[]): Workout | null {
  if (workouts.length === 0) return null;
  let earliest = workouts[0];
  let earliestMs = +new Date(earliest.logged_at);
  for (let i = 1; i < workouts.length; i++) {
    const ms = +new Date(workouts[i].logged_at);
    if (ms < earliestMs) {
      earliest = workouts[i];
      earliestMs = ms;
    }
  }
  return earliest;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCol: {
    flex: 1,
    gap: 4,
  },
  range: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
  },
  goalHitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.7)',
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
  },
  goalHitText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  goalHitFire: {
    fontSize: 12,
  },
  daysCol: {
    gap: spacing.sm,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  // Invisible same-width spacer so cells in a partial row line up with the
  // corresponding columns in the row above.
  padCell: {
    flex: 1,
  },
});
