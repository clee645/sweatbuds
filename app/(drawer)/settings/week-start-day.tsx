import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsSection } from '@/components/settings/SettingsSection';
import { usePartnership } from '@/lib/partnership';
import { colors, spacing, typography } from '@/lib/theme';
import {
  getCurrentWeekStartDay,
  getPendingAnchor,
  getWeekWindow,
  nextDayOnOrAfter,
} from '@/lib/week';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function fmtDate(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export default function WeekStartDayScreen() {
  const { partnership, setWeekStartDay } = usePartnership();
  const [saving, setSaving] = useState<number | null>(null);

  const currentDay = getCurrentWeekStartDay(partnership);
  const pendingAnchor = getPendingAnchor(partnership);
  const weekWindow = getWeekWindow(partnership);

  const pendingFooter = useMemo(() => {
    if (!pendingAnchor) return null;
    return `Takes effect ${DAY_NAMES[pendingAnchor.getDay()]}, ${fmtDate(pendingAnchor)}`;
  }, [pendingAnchor]);

  const handlePick = (day: number) => {
    if (saving !== null) return;
    if (currentDay === day) {
      Alert.alert('Already set', `Your week already starts on ${DAY_NAMES[day]}.`);
      return;
    }
    // Mirror setWeekStartDay's math: anchor to the END of the current cycle
    // so the in-progress week never shrinks.
    if (!weekWindow) {
      Alert.alert('Could not update', 'No active week.');
      return;
    }
    const cycleEnd = new Date(weekWindow.weekStart);
    cycleEnd.setDate(cycleEnd.getDate() + 7);
    const next = nextDayOnOrAfter(day, cycleEnd);
    const newEnd = new Date(next);
    newEnd.setDate(newEnd.getDate() - 1);

    const lines = [
      `Your current week will run through ${fmtDate(newEnd)}.`,
      `New weeks will start on ${DAY_NAMES[day]}, beginning ${fmtDate(next)}.`,
    ];

    Alert.alert('Change week start day?', lines.join('\n\n'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update',
        onPress: () => {
          void (async () => {
            setSaving(day);
            try {
              await setWeekStartDay(day);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Try again.';
              Alert.alert('Could not update', msg);
            } finally {
              setSaving(null);
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Week Start Day</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Pick the day your weekly cycle starts on. Your current week will extend until the
          next start day so you don&apos;t lose progress.
        </Text>

        <SettingsSection>
          {DAY_NAMES.map((name, day) => {
            const selected = currentDay === day;
            const isSaving = saving === day;
            return (
              <Pressable
                key={name}
                onPress={() => handlePick(day)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={[styles.dayName, selected && styles.dayNameActive]}>
                  {name}
                </Text>
                {isSaving ? (
                  <Text style={styles.savingText}>Saving…</Text>
                ) : selected ? (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </SettingsSection>

        {pendingFooter ? (
          <Text style={styles.pendingNote}>{pendingFooter}</Text>
        ) : null}
      </ScrollView>
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
  headerTitle: { ...typography.bodyStrong, fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  intro: {
    ...typography.caption,
    fontSize: 13,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  pressed: { opacity: 0.6 },
  dayName: { ...typography.body, fontSize: 16, fontWeight: '500' },
  dayNameActive: { color: colors.accent },
  savingText: { ...typography.caption, fontSize: 12, color: colors.textMuted },
  pendingNote: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
