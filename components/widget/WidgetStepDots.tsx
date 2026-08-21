import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

// Page indicator for the widget walkthrough — one dot per step.
export function WidgetStepDots({ page, total = 4 }: { page: number; total?: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textDim,
    opacity: 0.6,
  },
  dotActive: { backgroundColor: colors.text, opacity: 1 },
});
