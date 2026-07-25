import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { WeekdayKey } from '@/types/db';

// JS getDay (Sun=0..Sat=6) → WeekdayKey + display label.
const DAY_INDEX_TO_KEY: Record<number, WeekdayKey> = {
  0: 'S2',
  1: 'M',
  2: 'T2',
  3: 'W',
  4: 'T1',
  5: 'F',
  6: 'S1',
};
const DAY_INDEX_TO_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  completed: WeekdayKey[];
  // JS getDay (0=Sun..6=Sat). Defaults to 3 (Wed) for back-compat with
  // callers that don't yet know about configurable week start.
  weekStartDay?: number;
  // Number of extra days beyond the standard 7 — drives the "+N" pill.
  extraDays?: number;
  onPressOverflow?: () => void;
  size?: number;
};

export function WeekDots({
  completed,
  weekStartDay = 3,
  extraDays = 0,
  onPressOverflow,
  size = 26,
}: Props) {
  const isDone = (k: WeekdayKey) => completed.includes(k);

  const labels = Array.from({ length: 7 }, (_, i) => {
    const dayIdx = (weekStartDay + i) % 7;
    return { key: DAY_INDEX_TO_KEY[dayIdx], label: DAY_INDEX_TO_LABEL[dayIdx] };
  });

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {labels.slice(0, 4).map(({ key, label }, i) => (
          <Dot
            key={`${key}-${i}`}
            label={label}
            active={isDone(key)}
            size={size}
          />
        ))}
      </View>
      <View style={[styles.row, styles.rowTwo]}>
        {labels.slice(4).map(({ key, label }, i) => (
          <Dot
            key={`${key}-${i}`}
            label={label}
            active={isDone(key)}
            size={size}
          />
        ))}
        {extraDays > 0 ? (
          <OverflowPill
            label={`+${extraDays}`}
            size={size}
            onPress={onPressOverflow}
          />
        ) : null}
      </View>
    </View>
  );
}

function Dot({ label, active, size }: { label: string; active: boolean; size: number }) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2 },
        active ? styles.dotActive : styles.dotInactive,
      ]}
    >
      <Text style={[styles.dotText, active ? styles.dotTextActive : styles.dotTextInactive]}>
        {label}
      </Text>
    </View>
  );
}

function OverflowPill({
  label,
  size,
  onPress,
}: {
  label: string;
  size: number;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        styles.overflow,
        { height: size, borderRadius: size / 2, paddingHorizontal: size * 0.45 },
      ]}
    >
      <Text style={styles.overflowText}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [pressed && styles.overflowPressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 6 },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  rowTwo: { paddingLeft: 16 },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dotActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  dotText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dotTextActive: { color: colors.text },
  dotTextInactive: { color: colors.textDim },
  overflow: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overflowText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  overflowPressed: { opacity: 0.6 },
});
