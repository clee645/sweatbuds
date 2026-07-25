import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';

type Props = {
  name: string;
  address: string | null;
  onPressEllipsis: () => void;
};

export function SavedLocationRow({ name, address, onPressEllipsis }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.pinWrap}>
        <Ionicons name="location" size={22} color={colors.accent} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {address ? (
          <Text style={styles.address} numberOfLines={1}>
            {address}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onPressEllipsis}
        hitSlop={12}
        style={({ pressed }) => [styles.ellipsisBtn, pressed && styles.pressed]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pinWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, fontSize: 16 },
  address: { ...typography.caption },
  ellipsisBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
