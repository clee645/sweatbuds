import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { useHistoryWorkouts } from '@/lib/history';
import {
  bucketWorkoutsByPartnershipWeek,
  partnershipWeekGoalHit,
} from '@/lib/historyWeek';
import { usePartnership } from '@/lib/partnership';
import { supabase } from '@/lib/supabase';
import { colors, gradients, radii, spacing, typography } from '@/lib/theme';

type DisplayWager = {
  id: string;
  terms: string;
  youWon: boolean;
};

export default function WagerBalanceScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { partnership, partner, anchorHistory, weekTimezone } = usePartnership();
  const { workouts: historyWorkouts } = useHistoryWorkouts();
  const { width } = useWindowDimensions();

  const [wagers, setWagers] = useState<DisplayWager[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<DisplayWager>>(null);

  const userId = user?.id ?? null;
  const partnershipId = partnership?.status === 'active' ? partnership.id : null;

  const load = useCallback(async () => {
    if (!partnershipId || !userId) {
      setWagers([]);
      setActiveIndex(0);
      return;
    }
    const { data } = await supabase
      .from('wagers')
      .select('id, terms, status, winner_user_id, week_start')
      .eq('partnership_id', partnershipId)
      .in('status', ['won', 'lost'])
      .not('winner_user_id', 'is', null)
      .order('week_start', { ascending: false });
    setWagers(
      (data ?? []).map((w) => ({
        id: w.id as string,
        terms: w.terms as string,
        youWon: w.winner_user_id === userId,
      })),
    );
    setActiveIndex(0);
  }, [partnershipId, userId]);

  // Reload each time the screen gains focus so a background settlement pass
  // (see WagerSettlementRunner) surfaces immediately when the user navigates in.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(idx, Math.max(wagers.length - 1, 0))));
  };

  const markOne = async () => {
    const target = wagers[activeIndex];
    if (!target) return;
    const next = wagers.filter((_, i) => i !== activeIndex);
    setWagers(next);
    const newIndex = Math.min(activeIndex, Math.max(next.length - 1, 0));
    setActiveIndex(newIndex);
    requestAnimationFrame(() => {
      if (next.length > 0) {
        flatListRef.current?.scrollToOffset({
          offset: newIndex * width,
          animated: true,
        });
      }
    });
    const { error } = await supabase
      .from('wagers')
      .update({ status: 'settled' })
      .eq('id', target.id);
    if (error) await load();
  };

  const markAll = async () => {
    const ids = wagers.map((w) => w.id);
    setWagers([]);
    setActiveIndex(0);
    if (ids.length > 0) {
      const { error } = await supabase
        .from('wagers')
        .update({ status: 'settled' })
        .in('id', ids);
      if (error) await load();
    }
  };

  const partnerName = partner?.display_name ?? 'your partner';
  const current = wagers[activeIndex];
  const subtitle = current
    ? current.youWon
      ? `${partnerName} owes you`
      : `you owe ${partnerName}`
    : '';

  const isEmpty = wagers.length === 0;
  const showDots = wagers.length > 1;

  // When there are no outstanding debts, celebrate only if the most recent
  // completed, settlement-eligible week was a genuine both-hit. A both-missed
  // week (a wash) or an already-paid one-misser week falls back to neutral copy
  // so we never wrongly celebrate a week where someone actually owed.
  const emptyState = useMemo(() => {
    const neutral = { title: 'All caught up!', subtitle: null as string | null };
    if (!isEmpty) return neutral;
    if (!partnership || partnership.status !== 'active' || !userId || !partner?.id) {
      return neutral;
    }
    const epochMs = partnership.wager_ledger_since
      ? new Date(partnership.wager_ledger_since).getTime()
      : NaN;
    if (Number.isNaN(epochMs)) return neutral;
    const target = partnership.weekly_target ?? 3;
    const now = Date.now();
    const mine = historyWorkouts.filter((w) => w.partnership_id === partnership.id);
    const buckets = bucketWorkoutsByPartnershipWeek(
      mine,
      partnership,
      anchorHistory,
      weekTimezone,
    );
    // Buckets are newest-first; take the most recent completed eligible week.
    const recent = buckets.find(
      (b) => b.weekEnd.getTime() <= now && b.weekEnd.getTime() > epochMs,
    );
    if (!recent) return neutral;
    if (partnershipWeekGoalHit(recent.workouts, userId, partner.id, target, weekTimezone)) {
      return {
        title: 'You both hit your goal 🎉',
        subtitle: 'Nobody owes anything.',
      };
    }
    return neutral;
  }, [
    isEmpty,
    partnership,
    partner?.id,
    userId,
    anchorHistory,
    historyWorkouts,
  ]);

  const keyExtractor = useCallback((w: DisplayWager) => w.id, []);

  const renderItem = useCallback(
    ({ item }: { item: DisplayWager }) => (
      <View style={[styles.slide, { width }]}>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {item.terms}
        </Text>
      </View>
    ),
    [width],
  );

  const getItemLayout = useMemo(
    () => (_: ArrayLike<DisplayWager> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Wager Balance</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.spacer} />

      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{emptyState.title}</Text>
          {emptyState.subtitle ? (
            <Text style={styles.emptySubtext}>{emptyState.subtitle}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <FlatList
            ref={flatListRef}
            data={wagers}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            getItemLayout={getItemLayout}
            style={styles.carousel}
          />
          {showDots ? (
            <View style={styles.dotsRow}>
              {wagers.map((w, i) => (
                <View
                  key={w.id}
                  style={[styles.dot, i === activeIndex && styles.dotActive]}
                />
              ))}
            </View>
          ) : (
            <View style={styles.dotsSpacer} />
          )}
        </View>
      )}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Pressable
          onPress={markOne}
          disabled={isEmpty}
          style={({ pressed }) => [
            styles.primaryShadow,
            pressed && styles.pressed,
            isEmpty && styles.disabled,
          ]}
        >
          <LinearGradient
            colors={gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryLabel}>Mark one as done</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={markAll}
          disabled={isEmpty}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            isEmpty && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryLabel}>Mark all as done</Text>
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  center: { alignItems: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  carousel: {
    flexGrow: 0,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  amount: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotsSpacer: {
    height: 8,
    marginTop: spacing.xl,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  primaryShadow: {
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderRadius: radii.pill,
  },
  primaryButton: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  secondaryButton: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.4 },
});
