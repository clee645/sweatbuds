import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';
import { formatWager, type WagerRule } from '@/lib/wagers';

type Props = {
  wager: WagerRule;
};

export function WagerGlowCard({ wager }: Props) {
  const label =
    wager.text === '$' ? `$${wager.quantity}` : `${wager.quantity} ${wager.text}`;
  return (
    <View style={styles.shell}>
      <LinearGradient
        colors={[colors.accentSoft, 'transparent', colors.accentSofter]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {wager.emoji ? <Text style={styles.emoji}>{wager.emoji}</Text> : null}
        <Text style={styles.label}>{label}</Text>
        <View style={styles.rule} />
      </LinearGradient>
    </View>
  );
}

export function getWagerGlowFormatted(wager: WagerRule): string {
  return formatWager(wager);
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.accentBorder,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  emoji: {
    fontSize: 48,
  },
  label: {
    ...typography.title,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  rule: {
    width: 80,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    opacity: 0.6,
    marginTop: spacing.sm,
  },
});
