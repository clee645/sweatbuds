import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/lib/theme';

export function HomeSkeleton() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <View style={styles.headerPill} />
        <View style={styles.headerCircle} />
      </View>

      <View style={styles.content}>
        <View style={styles.heroBlock} />

        <View style={styles.cardBlock}>
          <View style={styles.skeletonHeading} />
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonSlot} />
            <View style={styles.skeletonSlot} />
          </View>
        </View>

        <View style={styles.cardBlock}>
          <View style={styles.skeletonHeading} />
          <View style={styles.skeletonStakesBody} />
        </View>

        <View style={styles.bottomSpacer} />

        <View style={styles.logButton} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerPill: {
    width: 120,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
  },
  headerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  heroBlock: {
    height: 220,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cardBlock: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  skeletonHeading: {
    width: 96,
    height: 16,
    borderRadius: radii.sm,
    backgroundColor: colors.cardElevated,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skeletonSlot: {
    flex: 1,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.cardElevated,
  },
  skeletonStakesBody: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.cardElevated,
  },
  bottomSpacer: { flex: 1 },
  logButton: {
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.lg,
  },
});
