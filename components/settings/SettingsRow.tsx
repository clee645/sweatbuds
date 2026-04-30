import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  accessory?: 'chevron' | 'text' | 'none';
  accessoryText?: string;
  accessoryColor?: string;
  onPress?: () => void;
  leadingElement?: ReactNode;
  destructive?: boolean;
};

export function SettingsRow({
  icon,
  iconBg = colors.cardElevated,
  iconColor = colors.text,
  title,
  subtitle,
  accessory = 'chevron',
  accessoryText,
  accessoryColor = colors.textMuted,
  onPress,
  leadingElement,
  destructive = false,
}: Props) {
  const titleColor = destructive ? colors.danger : colors.text;

  const content = (
    <View style={styles.row}>
      {leadingElement ? (
        <View style={styles.leading}>{leadingElement}</View>
      ) : icon ? (
        <View style={[styles.iconSquare, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.middle}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory === 'chevron' ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      ) : accessory === 'text' && accessoryText ? (
        <Text style={[styles.accessoryText, { color: accessoryColor }]}>{accessoryText}</Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {},
  pressed: { opacity: 0.6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  leading: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, fontSize: 16, fontWeight: '500' },
  subtitle: { ...typography.caption },
  accessoryText: { ...typography.caption },
});
