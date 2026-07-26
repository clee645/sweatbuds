import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlwaysAllowIllustration } from '@/components/location/AlwaysAllowIllustration';
import { ensureNotificationPermission } from '@/lib/location/notifications';
import {
  requestForegroundThenBackground,
  type PermissionLevel,
} from '@/lib/location/permissions';
import { useNotificationPermission } from '@/lib/location/useNotificationPermission';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  // Only ever `whenInUse | denied | undetermined` here — the route renders
  // ManagerScreen once we have `always`. Drives the copy, because "you picked
  // While Using the App" and "you said Never" need very different instructions.
  level: PermissionLevel;
  onPermissionMaybeChanged?: () => void;
};

const DEFAULT_COPY = {
  title: 'Never forget\nto log a workout',
  subtitle: 'allow these so we can remind you',
};

const COPY: Partial<Record<PermissionLevel, typeof DEFAULT_COPY>> = {
  whenInUse: {
    title: 'One more tap\nto get reminders',
    subtitle: 'you chose "While Using the App" — arrival reminders need "Always"',
  },
  denied: {
    title: 'Location is off\nfor Sweatbuds',
    subtitle: 'turn it on in Settings so we can remind you',
  },
};

export function GateScreen({ level, onPermissionMaybeChanged }: Props) {
  const requestedRef = useRef(false);
  const { level: notificationLevel, refresh: refreshNotifications } =
    useNotificationPermission();
  const copy = COPY[level] ?? DEFAULT_COPY;

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void (async () => {
      // Only auto-prompt someone who has never answered. A "While Using the
      // App" user has already chosen, and iOS gives us exactly one deferred
      // "Change to Always Allow?" prompt — spending it on mount would fire it
      // before they've read why we need it, and leave the row with nothing to
      // do but bounce to Settings. Let `fixLocation` spend it deliberately.
      if (level === 'undetermined') await requestForegroundThenBackground();
      // Location permission only buys us the background wake-up. Without
      // notification permission the arrival event fires and the user sees
      // nothing at all, so ask for both before letting them past this screen.
      await ensureNotificationPermission();
      await refreshNotifications();
      onPermissionMaybeChanged?.();
    })();
  }, [level, onPermissionMaybeChanged, refreshNotifications]);

  const openSettings = () => {
    void Linking.openSettings();
  };

  // iOS grants exactly one deferred "Change to Always Allow?" prompt, and only
  // while the user hasn't hard-denied. Try it first — jumping straight to
  // Settings for someone who has never seen a system dialog is the wrong ask —
  // and fall back to Settings if the level didn't actually move.
  const fixLocation = () => {
    if (level === 'denied') {
      openSettings();
      return;
    }
    void (async () => {
      const next = await requestForegroundThenBackground();
      onPermissionMaybeChanged?.();
      if (next !== 'always') openSettings();
    })();
  };

  // Re-prompt in-app when we still can; fall back to Settings once iOS has
  // stopped letting us ask.
  const fixNotifications = () => {
    if (notificationLevel === 'denied') {
      openSettings();
      return;
    }
    void (async () => {
      await ensureNotificationPermission();
      await refreshNotifications();
    })();
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

      <ScrollView
        // The illustration pushes this past a short screen's height, so let it
        // scroll rather than clipping the CTA. flexGrow keeps the footer pinned
        // to the bottom everywhere it still fits.
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.titleWrap, level === 'whenInUse' && styles.titleWrapTight]}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>

        {/* Only the "While Using the App" user needs to be shown which row to
            pick — everyone else is either about to see the system prompt or has
            to switch location on at all first. */}
        {level === 'whenInUse' ? (
          <View style={styles.illustrationWrap}>
            <AlwaysAllowIllustration />
          </View>
        ) : null}

        <View style={styles.toggleSection}>
          {/* This screen only renders while location is short of "Always", so
              that row is always the un-granted state. */}
          <PermissionRow
            icon="location"
            label="Always Allow"
            granted={false}
            onPress={fixLocation}
          />
          <View style={styles.divider} />
          <PermissionRow
            icon="notifications"
            label="Notifications"
            granted={notificationLevel === 'granted'}
            onPress={fixNotifications}
          />
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
            onPress={level === 'undetermined' ? fixLocation : openSettings}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>
              {level === 'undetermined' ? 'Continue' : 'Open Settings'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionRow({
  icon,
  label,
  granted,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  granted: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={granted ? undefined : onPress}
      disabled={granted}
      style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
    >
      <View style={styles.toggleIconWrap}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <View style={styles.toggleMiddle}>
        <Text style={styles.toggleTitle}>{label}</Text>
        {granted ? null : <Text style={styles.toggleHint}>tap to fix</Text>}
      </View>
      <View style={[styles.toggleSwitch, granted && styles.toggleSwitchOn]}>
        <View style={[styles.toggleKnob, granted && styles.toggleKnobOn]} />
      </View>
    </Pressable>
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
  scrollContent: {
    flexGrow: 1,
  },
  titleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  // The illustration supplies its own breathing room below the copy.
  titleWrapTight: {
    paddingBottom: spacing.lg,
  },
  illustrationWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
  toggleSwitchOn: {
    backgroundColor: colors.success,
    alignItems: 'flex-end',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.textDim,
  },
  toggleKnobOn: {
    backgroundColor: colors.text,
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
