import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

// Green-check reassurance line used across the paywall screens
// ("No Payment Due Now", "No commitment, cancel anytime", …).
export function NoPaymentDueRow({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name="checkmark" size={18} color={colors.text} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
});
