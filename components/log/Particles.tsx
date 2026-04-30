import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';

const COUNT = 14;

type Particle = {
  startX: number;
  startY: number;
  driftX: number;
  size: number;
  duration: number;
  delay: number;
  baseOpacity: number;
};

function makeParticles(): Particle[] {
  return Array.from({ length: COUNT }, () => {
    const size = 2 + Math.random() * 5;
    return {
      startX: Math.random() * 100,
      startY: 70 + Math.random() * 40,
      driftX: (Math.random() - 0.5) * 14,
      size,
      duration: 3500 + Math.random() * 3000,
      delay: Math.random() * 3000,
      baseOpacity: 0.45 + Math.random() * 0.4,
    };
  });
}

export function Particles() {
  const particles = useMemo(() => makeParticles(), []);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} particle={p} />
      ))}
    </Animated.View>
  );
}

function Particle({ particle }: { particle: Particle }) {
  const t = useSharedValue(0);

  // Kick off a delayed loop on mount.
  useMemo(() => {
    const start = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: particle.duration, easing: Easing.linear }),
        -1,
        false,
      );
    }, particle.delay);
    return () => clearTimeout(start);
  }, [particle, t]);

  const style = useAnimatedStyle(() => {
    const progress = t.value;
    const translateY = -progress * 600;
    const translateX = progress * particle.driftX;
    const fadeIn = Math.min(progress * 4, 1);
    const fadeOut = 1 - Math.max(0, (progress - 0.7) / 0.3);
    const opacity = particle.baseOpacity * fadeIn * fadeOut;
    return {
      opacity,
      transform: [{ translateY }, { translateX }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${particle.startX}%`,
          top: `${particle.startY}%`,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
