import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  name: string;
  address: string | null;
  disabled?: boolean;
  onAdd: () => void;
};

export function SearchResultRow({ name, address, disabled, onAdd }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name="location-outline" size={20} color={colors.textMuted} />
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
        onPress={onAdd}
        disabled={disabled}
        hitSlop={8}
        style={({ pressed }) => [
          styles.addBtn,
          disabled && styles.addBtnDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Ionicons name="add" size={20} color={disabled ? colors.textDim : colors.text} />
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, fontSize: 16 },
  address: { ...typography.caption },
  addBtn: {
    width: 40,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
