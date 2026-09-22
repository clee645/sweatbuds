import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'accent' | 'orange';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  // Shows a spinner in place of the label and blocks taps. Gives the CTA a
  // visible working state so a slow action never reads as a dead button.
  loading?: boolean;
};

// Pill-shaped onboarding CTA.
// `primary` — white filled (main action). `secondary` — outlined dark.
// `accent` — filled red accent. `orange` — filled orange (paywall CTAs).
// `accent`/`orange` render gray when disabled.
export function OnboardingButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: Props) {
  const blocked = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.btn,
        styles[variant],
        blocked &&
          (variant === 'accent' || variant === 'orange'
            ? styles.accentDisabled
            : styles.disabled),
        pressed && !blocked && styles.pressed,
      ]}
    >
      {loading ? (
        // Match the spinner to the variant's label color, so the two never drift.
        <ActivityIndicator color={StyleSheet.flatten(styles[`${variant}Label`]).color} />
      ) : (
        <Text
          style={[
            styles.label,
            styles[`${variant}Label`],
            blocked &&
              (variant === 'accent' || variant === 'orange') &&
              styles.accentDisabledLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: '#FFFFFF',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  orange: {
    backgroundColor: colors.orange,
  },
  accentDisabled: {
    backgroundColor: colors.cardElevated,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: { opacity: 0.85 },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryLabel: { color: '#1F1F1F' },
  secondaryLabel: { color: colors.text },
  accentLabel: { color: '#FFFFFF' },
  orangeLabel: { color: '#FFFFFF' },
  accentDisabledLabel: { color: colors.textDim },
});
