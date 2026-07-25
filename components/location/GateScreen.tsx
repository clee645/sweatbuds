import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestForegroundThenBackground } from '@/lib/location/permissions';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  onPermissionMaybeChanged?: () => void;
};

export function GateScreen({ onPermissionMaybeChanged }: Props) {
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void (async () => {
      await requestForegroundThenBackground();
      onPermissionMaybeChanged?.();
    })();
  }, [onPermissionMaybeChanged]);

  const openSettings = () => {
    void Linking.openSettings();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>Never forget{'\n'}to log a workout</Text>
        <Text style={styles.subtitle}>allow these so we can remind you</Text>
      </View>

      <View style={styles.toggleSection}>
        <Pressable onPress={openSettings} style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}>
          <View style={styles.toggleIconWrap}>
            <Ionicons name="location" size={22} color={colors.text} />
          </View>
          <View style={styles.toggleMiddle}>
            <Text style={styles.toggleTitle}>Always Allow</Text>
            <Text style={styles.toggleHint}>tap to fix</Text>
          </View>
          <View style={styles.toggleSwitch}>
            <View style={styles.toggleKnob} />
          </View>
        </Pressable>
        <View style={styles.divider} />
      </View>

      <View style={styles.footer}>
        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <Text style={styles.privacyText}>
            We never track your location.{'\n'}Apple only notifies us when you arrive at the spots you saved.
          </Text>
        </View>

        <Pressable
          onPress={openSettings}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>Open Settings</Text>
        </Pressable>
      </View>
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
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 14,
    textAlign: 'center',
  },
  toggleSection: {
    paddingHorizontal: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  toggleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleMiddle: { flex: 1, gap: 2 },
  toggleTitle: { ...typography.bodyStrong, fontSize: 17 },
  toggleHint: { color: colors.accent, fontSize: 13, fontWeight: '500' },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentDeep,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.textDim,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
  },
  pressed: { opacity: 0.6 },
  footer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  privacyText: {
    flex: 1,
    ...typography.caption,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  cta: {
    backgroundColor: colors.cardElevated,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  ctaText: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
});
