import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  partnerFirstName?: string | null;
};

export function FreshWeekHero({ partnerFirstName }: Props) {
  const subtitle = partnerFirstName
    ? `Set the tone for you\nand ${partnerFirstName}`
    : 'Log a workout to\nset the tone';

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <LinearGradient
          colors={['rgba(255, 90, 95, 0.03)', 'rgba(255, 90, 95, 0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glow}
          pointerEvents="none"
        />
        <View style={styles.iconGroup}>
          <View style={styles.dottedRing}>
            <View style={styles.innerRing}>
              <Ionicons name="flame" size={22} color={colors.accent} />
            </View>
          </View>

          <View style={styles.pill}>
            <Text style={styles.pillText}>NEW WEEK</Text>
          </View>
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            Start the week off strong
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    height: '55%',
  },
  iconGroup: {
    alignItems: 'center',
  },
  textGroup: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  dottedRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  innerRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.pillBg,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  title: {
    ...typography.display,
    fontSize: 22,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
