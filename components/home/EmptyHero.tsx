import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

export function EmptyHero() {
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
              <Ionicons name="barbell" size={22} color={colors.accent} />
            </View>
          </View>

          <View style={styles.startStrongPill}>
            <Text style={styles.startStrongText}>START STRONG</Text>
          </View>
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            Log your first workout
          </Text>
          <Text style={styles.subtitle}>
            Your workout will appear here{'\n'}once you start logging
          </Text>
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
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxxl,
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
  startStrongPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.pillBg,
  },
  startStrongText: {
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
