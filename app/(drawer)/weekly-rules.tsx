import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditRulesModal } from '@/components/weekly-rules/EditRulesModal';
import { WagerGlowCard } from '@/components/weekly-rules/WagerGlowCard';
import { usePartnership } from '@/lib/partnership';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { DEFAULT_WAGER, type WagerRule } from '@/lib/wagers';

export default function WeeklyRulesScreen() {
  const navigation = useNavigation();
  const { partnership } = usePartnership();
  const [editOpen, setEditOpen] = useState(false);

  const days = partnership?.weekly_target ?? 3;
  const wager: WagerRule = partnership
    ? {
        quantity: partnership.wager_quantity,
        text: partnership.wager_text,
        emoji: partnership.wager_emoji,
      }
    : DEFAULT_WAGER;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setEditOpen(true)}
          style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={16} color={colors.text} />
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.mainBlock}>
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.sparkle}>✦</Text>
              <Text style={styles.title}>WEEKLY WAGER</Text>
              <Text style={styles.sparkle}>✦</Text>
            </View>
            <Text style={styles.subtitle}>Work out at least</Text>
          </View>

          <View style={styles.daysBlock}>
            <Text style={styles.daysNumber}>{days}</Text>
            <Text style={styles.daysSuffix}>days</Text>
          </View>

          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR YOU OWE</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.wagerWrap}>
            <WagerGlowCard wager={wager} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>KEEP EACH OTHER ACCOUNTABLE</Text>
        </View>
      </View>

      <EditRulesModal
        visible={editOpen}
        initialDays={days}
        initialWager={wager}
        onClose={() => setEditOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  editBtnPressed: { opacity: 0.7 },
  editLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  mainBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sparkle: {
    color: colors.text,
    fontSize: 16,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.text,
    fontSize: 16,
    letterSpacing: 3,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 20,
    marginTop: spacing.lg,
  },
  daysBlock: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  daysNumber: {
    color: colors.text,
    fontSize: 96,
    fontWeight: '700',
    lineHeight: 100,
  },
  daysSuffix: {
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: '500',
    marginLeft: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-end',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  wagerWrap: {
    marginTop: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.xxxl,
  },
  footerText: {
    ...typography.micro,
    letterSpacing: 2,
  },
});
