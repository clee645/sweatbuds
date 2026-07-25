import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyHero } from '@/components/home/EmptyHero';
import { FreshWeekHero } from '@/components/home/FreshWeekHero';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { LockedHome } from '@/components/home/LockedHome';
import { LogWorkoutButton } from '@/components/home/LogWorkoutButton';
import { StakesCard } from '@/components/home/StakesCard';
import { ThisWeekCard } from '@/components/home/ThisWeekCard';
import { WorkoutCarousel } from '@/components/home/WorkoutCarousel';
import { useAuth } from '@/lib/auth';
import { sharePartnerInvite } from '@/lib/invite';
import { usePartnership } from '@/lib/partnership';
import { colors, spacing } from '@/lib/theme';
import { useAccessGate } from '@/lib/useAccessGate';
import { useWeekRollover } from '@/lib/useWeekRollover';
import { DEFAULT_WAGER, type WagerRule } from '@/lib/wagers';
import {
  getPairedAnchor,
  getWeekWindow,
  partnershipWeekStreak,
  weekProgressFromWorkouts,
} from '@/lib/week';
import { useWorkouts } from '@/lib/workouts';
import type { Workout } from '@/types/db';

const ROLLOVER_ANIM_MS = 700;

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, profile } = useAuth();
  const { workouts, loading: workoutsLoading } = useWorkouts();
  const {
    partnership,
    partner,
    anchorHistory,
    loading: partnershipLoading,
    freshlyPaired,
    applyAnchorPromotion,
  } = usePartnership();

  const { unlocked, loading: gateLoading } = useAccessGate();

  const [archivingSnapshot, setArchivingSnapshot] = useState<Workout[] | null>(null);
  const archiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cold-start celebration: realtime fired during background, or the user
  // re-opened the app and we discovered an unseen active partnership.
  useEffect(() => {
    if (freshlyPaired?.viaColdStart) {
      router.replace({
        pathname: '/pairing-celebration',
        params: { name: freshlyPaired.partnerName },
      });
    }
  }, [freshlyPaired]);

  const isPaired = Boolean(
    partnership && partnership.status === 'active' && partnership.paired_at && partner,
  );

  const paidAnchor = getPairedAnchor(partnership);
  const weekWindow = isPaired ? getWeekWindow(partnership) : null;
  const weekStart = weekWindow?.weekStart ?? null;
  const weekEnd = weekWindow?.weekEnd ?? null;

  const thisWeekWorkouts = useMemo(() => {
    if (!weekStart || !weekEnd || !paidAnchor) return [];
    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd.getTime();
    const anchorMs = paidAnchor.getTime();
    return workouts.filter((w) => {
      const t = new Date(w.logged_at).getTime();
      if (Number.isNaN(t)) return false;
      if (t < anchorMs) return false;
      return t >= weekStartMs && t < weekEndMs;
    });
    // paidAnchor / weekStart / weekEnd are recomputed each render as new
    // Dates — use their times as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, weekStart?.getTime(), weekEnd?.getTime(), paidAnchor?.getTime()]);

  // Keep the "previous week" workouts available to the rollover handler so it
  // can snapshot them at the moment the boundary advances.
  const thisWeekRef = useRef<Workout[]>(thisWeekWorkouts);
  thisWeekRef.current = thisWeekWorkouts;

  useWeekRollover(
    partnership,
    () => {
      const snapshot = thisWeekRef.current;
      if (snapshot.length === 0) return;
      setArchivingSnapshot(snapshot);
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
      archiveTimerRef.current = setTimeout(() => {
        setArchivingSnapshot(null);
        archiveTimerRef.current = null;
      }, ROLLOVER_ANIM_MS);
    },
    applyAnchorPromotion,
  );

  useEffect(() => {
    return () => {
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
    };
  }, []);

  // Hydration gate: never render a half-loaded home after pairing. Also hold
  // while the subscription/partnership access gate is still resolving so we
  // don't flash LockedHome to a paid user before RevenueCat re-confirms.
  const partnershipReady =
    !partnershipLoading &&
    (partnership === null ||
      partnership.status !== 'active' ||
      partner !== null);
  if (!partnershipReady || workoutsLoading || gateLoading) {
    return <HomeSkeleton />;
  }

  // Subscription gate: without an active subscription (own or partner's), the
  // real home is replaced by the "Start Your Journey" locked screen. This also
  // makes /log-workout unreachable while locked (no LogWorkoutButton rendered).
  if (!unlocked) {
    return <LockedHome />;
  }

  const handleInvite = async () => {
    if (!user) return;
    try {
      await sharePartnerInvite(user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not create invite', message);
    }
  };

  const handleLog = () => {
    router.push('/log-workout');
  };

  const profileForWeek =
    profile ??
    (user
      ? {
          id: user.id,
          display_name: 'You',
          avatar_url: null,
          created_at: '',
          timezone: null,
          is_pro: false,
        }
      : null);

  const target = partnership?.weekly_target ?? 3;
  const wager: WagerRule = partnership
    ? {
        quantity: partnership.wager_quantity,
        text: partnership.wager_text,
        emoji: partnership.wager_emoji,
      }
    : DEFAULT_WAGER;

  const userWeek = profileForWeek
    ? weekProgressFromWorkouts(workouts, profileForWeek, target, weekStart, weekEnd)
    : null;
  const partnerWeek = partner
    ? weekProgressFromWorkouts(workouts, partner, target, weekStart, weekEnd)
    : null;

  const hasLoggedToday = workouts.some((w) => {
    if (!user || w.user_id !== user.id) return false;
    const t = new Date(w.logged_at);
    if (Number.isNaN(t.getTime())) return false;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return t.getTime() >= startOfToday.getTime();
  });

  // Combined workouts the couple has logged in the current week — shown until
  // the partnership has its first goal-hit week and the pill swaps to streak.
  const thisWeekJointCount = thisWeekWorkouts.length;

  const streak = isPaired
    ? partnershipWeekStreak(
        workouts,
        partnership,
        anchorHistory,
        user?.id ?? null,
        partner?.id ?? null,
        target,
      )
    : 0;

  // Hero selection:
  // - Archiving (paired-only path): keep showing the prior week's carousel
  //   driving the archive animation. Once the timer expires, the snapshot
  //   clears and we re-evaluate.
  // - Unpaired: EmptyHero when no workouts, else the user's solo carousel.
  // - Paired + no workouts this week: FreshWeekHero.
  // - Paired + has workouts this week: WorkoutCarousel filtered to this week.
  let hero: React.ReactNode;
  if (archivingSnapshot) {
    hero = <WorkoutCarousel workouts={archivingSnapshot} archiving />;
  } else if (!isPaired) {
    hero = workouts.length === 0 ? <EmptyHero /> : <WorkoutCarousel workouts={workouts} />;
  } else if (thisWeekWorkouts.length === 0) {
    hero = <FreshWeekHero partnerFirstName={partner?.display_name ?? null} />;
  } else {
    hero = <WorkoutCarousel workouts={thisWeekWorkouts} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <HomeHeader
        workoutCount={thisWeekJointCount}
        streak={streak}
        hasPartner={isPaired}
        onOpenDrawer={() => navigation.dispatch(DrawerActions.openDrawer())}
        onPressInvite={handleInvite}
      />

      <View style={styles.content}>
        <View style={styles.heroWrap}>{hero}</View>

        {userWeek ? (
          <View style={styles.shiftUp}>
            <ThisWeekCard
              userWeek={userWeek}
              partnerWeek={partnerWeek}
              weekWindow={weekWindow ?? undefined}
              workouts={isPaired ? thisWeekWorkouts : undefined}
              partnerId={partner?.id ?? null}
              onInvitePartner={handleInvite}
            />
          </View>
        ) : null}

        <View style={styles.stakesGap}>
          <StakesCard
            days={target}
            wager={wager}
            onPressInfo={() => router.push('/wager-info')}
          />
        </View>

        <View style={styles.bottomSpacer} />

        <LogWorkoutButton hasLoggedToday={hasLoggedToday} onPress={handleLog} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  heroWrap: {
    flex: 3.2,
    minHeight: 0,
    marginHorizontal: -spacing.md,
  },
  shiftUp: {
    marginTop: -spacing.md,
  },
  stakesGap: {
    marginTop: -2,
  },
  bottomSpacer: {
    flex: 0.3,
  },
});
