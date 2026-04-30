import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';

type Variant = 'messages' | 'instagram' | 'save' | 'more';

const SIZE = 64;

type Props = {
  variant: Variant;
  label: string;
  onPress: () => void;
};

export function ShareTargetButton({ variant, label, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      {({ pressed }) => (
        <View style={[styles.column, pressed && styles.pressed]}>
          {renderIcon(variant)}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function renderIcon(variant: Variant) {
  switch (variant) {
    case 'messages':
      return (
        <View style={[styles.circle, { backgroundColor: '#34C759' }]}>
          <Ionicons name="chatbubble" size={28} color="#FFFFFF" />
        </View>
      );
    case 'instagram':
      return (
        <LinearGradient
          colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.circle}
        >
          <Ionicons name="logo-instagram" size={30} color="#FFFFFF" />
        </LinearGradient>
      );
    case 'save':
      return (
        <View style={[styles.circle, { backgroundColor: colors.cardElevated }]}>
          <Ionicons name="arrow-down" size={28} color={colors.text} />
        </View>
      );
    case 'more':
      return (
        <View style={[styles.circle, { backgroundColor: colors.cardElevated }]}>
          <Ionicons name="share-outline" size={26} color={colors.text} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  column: { alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.7 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.text,
  },
});
