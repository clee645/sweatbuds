import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, gradients, radii, spacing } from '@/lib/theme';

type Props = {
  hasLoggedToday: boolean;
  onPress: () => void;
};

export function LogWorkoutButton({ hasLoggedToday, onPress }: Props) {
  const label = hasLoggedToday ? 'Log another workout' : "Log today's workout";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={gradients.cta}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.button}
      >
        <View style={styles.row}>
          <Ionicons name="camera" size={20} color={colors.text} />
          <Text style={styles.label}>{label}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderRadius: radii.lg,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  button: {
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
