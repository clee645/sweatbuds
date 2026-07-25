import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThisWeekCard } from '@/components/home/ThisWeekCard';
import { usePartnership } from '@/lib/partnership';
import { colors, spacing, typography } from '@/lib/theme';
import { getSoloWeekWindow, getWeekWindow, weekProgressFromWorkouts } from '@/lib/week';
import type { Profile, Workout } from '@/types/db';
import { Particles } from './Particles';
import { PostComposition } from './PostComposition';

const FADE_IN_MS = 280;
const HOLD_MS = 3000;
const FADE_OUT_MS = 320;

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
  const { partnership } = usePartnership();
  const weekWindow = getWeekWindow(partnership) ?? getSoloWeekWindow();
  const userWeek = weekProgressFromWorkouts(
    allWorkouts,
    user,
    3,
    weekWindow.weekStart,
    weekWindow.weekEnd,
  );
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const seq = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }),
    ]);
    seq.start(({ finished }) => {
      if (finished) router.back();
    });
    return () => {
      seq.stop();
    };
  }, [router, opacity]);

  return (
    <Animated.View style={[styles.root, { opacity }]}>
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
            weekWindow={weekWindow}
            hideInviteSlot
            variant="solo"
          />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  titleWrap: {
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
    alignItems: 'center',
  },
  composition: {
    width: '70%',
  },
  footer: {
    // sits directly below the composition, tight to the image
  },
});
