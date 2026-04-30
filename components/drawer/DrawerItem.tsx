import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Variant = 'default' | 'accent';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  variant?: Variant;
  badge?: string;
  disabled?: boolean;
};

export function DrawerItem({ icon, label, onPress, variant = 'default', badge, disabled }: Props) {
  const isAccent = variant === 'accent';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.row,
        isAccent && styles.rowAccent,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={[styles.iconWrap, isAccent && styles.iconWrapAccent]}>
        <Ionicons
          name={icon}
          size={20}
          color={isAccent ? colors.accent : colors.text}
        />
      </View>
      <Text style={[styles.label, isAccent && styles.labelAccent]} numberOfLines={1}>
        {label}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    gap: spacing.md,
  },
  rowAccent: {
    backgroundColor: colors.accentSofter,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
  },
  rowPressed: { backgroundColor: colors.card },
  rowDisabled: { opacity: 0.85 },
  iconWrap: {
    width: 28,
    alignItems: 'center',
  },
  iconWrapAccent: {},
  label: {
    flex: 1,
    ...typography.bodyStrong,
    fontWeight: '500',
  },
  labelAccent: { color: colors.text },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.6,
  },
});
