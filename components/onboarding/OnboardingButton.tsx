import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'accent' | 'orange';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
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
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        styles[variant],
        disabled &&
          (variant === 'accent' || variant === 'orange'
            ? styles.accentDisabled
            : styles.disabled),
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          styles[`${variant}Label`],
          disabled &&
            (variant === 'accent' || variant === 'orange') &&
            styles.accentDisabledLabel,
        ]}
      >
        {label}
      </Text>
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
