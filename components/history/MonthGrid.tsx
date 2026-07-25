import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CalendarDayTile } from '@/components/history/CalendarDayTile';
import { isoLocalDate } from '@/lib/historyWeek';
import { colors, spacing, typography } from '@/lib/theme';
import type { Workout } from '@/types/db';

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

type Props = {
  year: number;
  month: number; // 0-11
  // Map isoDate -> workouts (sorted ASC). Earliest workout's selfie is shown.
  byDay: Record<string, Workout[]>;
  // Map storage path -> signed URL. Resolved by the parent and shared.
  uriMap: Record<string, string>;
};

type Cell = {
  dayNumber: number | null;
  isoDate: string | null;
  imageUri: string | null;
};

export function MonthGrid({ year, month, byDay, uriMap }: Props) {
  const cells = useMemo(() => buildCells(year, month, byDay, uriMap), [year, month, byDay, uriMap]);
  const rows = useMemo(() => {
    const out: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cells]);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {MONTHS_LONG[month]} {year}
      </Text>
      <View style={styles.headerRow}>
        {WEEKDAY_HEADERS.map((h) => (
          <Text key={h} style={styles.headerCell}>
            {h}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((cell, colIdx) => (
              <CalendarDayTile
                key={`${rowIdx}-${colIdx}`}
                dayNumber={cell.dayNumber}
                isoDate={cell.isoDate}
                imageUri={cell.imageUri}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function buildCells(
  year: number,
  month: number,
  byDay: Record<string, Workout[]>,
  uriMap: Record<string, string>,
): Cell[] {
  const firstOfMonth = new Date(year, month, 1);
  // Mon=0..Sun=6 offset for the first row.
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Cell[] = [];
  for (let i = 0; i < leading; i++) {
    cells.push({ dayNumber: null, isoDate: null, imageUri: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const iso = isoLocalDate(d);
    const dayWorkouts = byDay[iso];
    let imageUri: string | null = null;
    if (dayWorkouts && dayWorkouts.length > 0) {
      // bucketWorkoutsByDay sorts each bucket ASC, so [0] is the earliest.
      const earliest = dayWorkouts[0];
      imageUri = uriMap[earliest.selfie_path] ?? null;
    }
    cells.push({ dayNumber: day, isoDate: iso, imageUri });
  }
  // Pad to a full week so the last row stays aligned with the grid above.
  while (cells.length % 7 !== 0) {
    cells.push({ dayNumber: null, isoDate: null, imageUri: null });
  }
  return cells;
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.title,
    fontSize: 20,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  grid: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
});
