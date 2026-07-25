import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarView } from '@/components/history/CalendarView';
import { ViewToggle, type HistoryView } from '@/components/history/ViewToggle';
import { WeeklyView } from '@/components/history/WeeklyView';
import { useHistoryWorkouts } from '@/lib/history';
import { colors, spacing, typography } from '@/lib/theme';

const TOGGLE_HEIGHT = 44;

export default function HistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { workouts, loading } = useHistoryWorkouts();
  const [view, setView] = useState<HistoryView>('weekly');

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigation.dispatch(DrawerActions.openDrawer());
  };

  // Reserve enough space below the scrolling content so the floating toggle
  // pill doesn't sit over the last card. SafeAreaView already pads insets.bottom,
  // so we only need pad for the pill height + a bit of breathing room.
  const togglePad = TOGGLE_HEIGHT + spacing.xxl;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>History</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.textMuted} />
          </View>
        ) : view === 'weekly' ? (
          <WeeklyView workouts={workouts} bottomPad={togglePad} />
        ) : (
          <CalendarView workouts={workouts} bottomPad={togglePad} />
        )}
      </View>

      <View style={[styles.toggleWrap, { bottom: insets.bottom + spacing.md }]}>
        <ViewToggle active={view} onChange={setView} />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.bodyStrong, fontSize: 18 },
  body: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
