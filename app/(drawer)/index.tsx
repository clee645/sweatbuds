import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyHero } from '@/components/home/EmptyHero';
import { HomeHeader } from '@/components/home/HomeHeader';
import { LogWorkoutButton } from '@/components/home/LogWorkoutButton';
import { StakesCard } from '@/components/home/StakesCard';
import { ThisWeekCard } from '@/components/home/ThisWeekCard';
import { WorkoutCarousel } from '@/components/home/WorkoutCarousel';
import { useAuth } from '@/lib/auth';
import { sharePartnerInvite } from '@/lib/invite';
import { usePartnership } from '@/lib/partnership';
import { colors, spacing } from '@/lib/theme';
import { getCurrentWeekStart, weekProgressFromWorkouts } from '@/lib/week';
import { useWorkouts } from '@/lib/workouts';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, profile } = useAuth();
  const { workouts } = useWorkouts();
  const { partnership, partner } = usePartnership();

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
      ? { id: user.id, display_name: 'You', avatar_url: null, created_at: '', timezone: null }
      : null);

  const target = partnership?.weekly_target ?? 3;
  const userWeek = profileForWeek
    ? weekProgressFromWorkouts(workouts, profileForWeek, target)
    : null;
  const partnerWeek = partner ? weekProgressFromWorkouts(workouts, partner, target) : null;

  const weekStart = getCurrentWeekStart().getTime();
  const hasLoggedToday = workouts.some((w) => {
    if (!user || w.user_id !== user.id) return false;
    const t = new Date(w.logged_at);
    if (Number.isNaN(t.getTime())) return false;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return t.getTime() >= startOfToday.getTime() && t.getTime() >= weekStart;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <HomeHeader
        workoutCount={workouts.length}
        onOpenDrawer={() => navigation.dispatch(DrawerActions.openDrawer())}
        onPressInvite={handleInvite}
      />

      <View style={styles.content}>
        <View style={styles.heroWrap}>
          {workouts.length === 0 ? (
            <EmptyHero />
          ) : (
            <WorkoutCarousel workouts={workouts} />
          )}
        </View>

        {userWeek ? (
          <View style={styles.shiftUp}>
            <ThisWeekCard
              userWeek={userWeek}
              partnerWeek={partnerWeek}
              onInvitePartner={handleInvite}
            />
          </View>
        ) : null}

        <View style={styles.stakesGap}>
          <StakesCard onPressInfo={() => router.push('/wager-info')} />
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
