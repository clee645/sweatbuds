import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThisWeekCard } from '@/components/home/ThisWeekCard';
import { colors, spacing, typography } from '@/lib/theme';
import { weekProgressFromWorkouts } from '@/lib/week';
import type { Profile, Workout } from '@/types/db';
import { Particles } from './Particles';
import { PostComposition } from './PostComposition';

const DISMISS_AFTER_MS = 2800;

type Props = {
  workout: Workout;
  selfieUri: string;
  environmentUri: string;
  user: Profile;
  allWorkouts: Workout[];
};

export function SuccessStep({
  workout,
  selfieUri,
  environmentUri,
  user,
  allWorkouts,
}: Props) {
  const router = useRouter();
  const userWeek = weekProgressFromWorkouts(allWorkouts, user);

  useEffect(() => {
    const t = setTimeout(() => {
      router.back();
    }, DISMISS_AFTER_MS);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(255, 90, 95, 0.18)', 'rgba(255, 90, 95, 0.04)', 'rgba(0, 0, 0, 0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Particles />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Logged</Text>
          <Text style={styles.subtitle}>You're on fire</Text>
        </View>

        <View style={styles.compositionWrap}>
          <PostComposition
            selfieUri={selfieUri}
            environmentUri={environmentUri}
            caption={workout.caption}
            style={styles.composition}
          />
        </View>

        <View style={styles.footer}>
          <ThisWeekCard
            userWeek={userWeek}
            partnerWeek={null}
            onInvitePartner={() => {}}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  titleWrap: {
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: 32,
  },
  subtitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  compositionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  composition: {
    width: '70%',
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
