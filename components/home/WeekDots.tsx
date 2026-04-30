import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { WeekdayKey } from '@/types/db';

const DAY_LABELS: { key: WeekdayKey; label: string }[] = [
  { key: 'W', label: 'W' },
  { key: 'T1', label: 'T' },
  { key: 'F', label: 'F' },
  { key: 'S1', label: 'S' },
  { key: 'S2', label: 'S' },
  { key: 'M', label: 'M' },
  { key: 'T2', label: 'T' },
];

type Props = {
  completed: WeekdayKey[];
  size?: number;
};

export function WeekDots({ completed, size = 26 }: Props) {
  const isDone = (k: WeekdayKey) => completed.includes(k);

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {DAY_LABELS.slice(0, 4).map(({ key, label }) => (
          <Dot key={key} label={label} active={isDone(key)} size={size} />
        ))}
      </View>
      <View style={[styles.row, styles.rowTwo]}>
        {DAY_LABELS.slice(4).map(({ key, label }) => (
          <Dot key={key} label={label} active={isDone(key)} size={size} />
        ))}
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

const styles = StyleSheet.create({
  grid: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
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
});
