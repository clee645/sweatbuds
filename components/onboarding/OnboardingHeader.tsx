import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

type Props = {
  // 1-based index of the current step (drives the bar fill via step/totalSteps).
  step?: number;
  totalSteps?: number;
  // Direct fill fraction (0–1). When set, overrides step/totalSteps — used by
  // the setup screens, which sit outside the 5-step onboarding model.
  progress?: number;
};

// Back arrow + thin progress bar shown on the stepped onboarding screens.
export function OnboardingHeader({ step = 0, totalSteps = 5, progress }: Props) {
  const router = useRouter();
  const fill = Math.min(1, Math.max(0, progress ?? step / totalSteps));

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  pressed: { opacity: 0.5 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderSoft,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
});
