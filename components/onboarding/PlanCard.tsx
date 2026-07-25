import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

type Props = {
  title: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
};

// One selectable subscription plan in the paywall's Monthly/Yearly picker.
export function PlanCard({ title, price, period, badge, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.price}>
            {price}
            <Text style={styles.period}>{period}</Text>
          </Text>
        </View>

        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 86,
    justifyContent: 'center',
  },
  cardSelected: {
    borderColor: colors.orange,
  },
  badge: {
    position: 'absolute',
    top: -11,
    alignSelf: 'center',
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  price: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  period: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
});
