import { useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';

const COUNT = 70;
const COLORS = [colors.orange, colors.accent, colors.success, colors.warning, '#FFFFFF'];
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Piece = {
  originX: number;
  originY: number;
  vx: number;
  vy0: number;
  gravity: number;
  rotation: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// One celebratory burst — pieces fire up and outward from the screen centre,
// then gravity drags them down so they sprinkle everywhere.
function makePieces(): Piece[] {
  return Array.from({ length: COUNT }, () => ({
    originX: SCREEN_W / 2 + rand(-SCREEN_W * 0.12, SCREEN_W * 0.12),
    originY: SCREEN_H * 0.46,
    vx: rand(-SCREEN_W * 0.7, SCREEN_W * 0.7),
    vy0: rand(-SCREEN_H * 0.85, -SCREEN_H * 0.35),
    gravity: rand(SCREEN_H * 0.7, SCREEN_H * 1.2),
    rotation: rand(-1100, 1100),
    size: rand(6, 11),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: rand(1900, 3000),
    delay: rand(0, 160),
  }));
}

export function ConfettiBurst() {
  const pieces = useMemo(() => makePieces(), []);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} />
      ))}
    </Animated.View>
  );
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const t = useSharedValue(0);

  // Fire once on mount, after the piece's small stagger delay.
  useMemo(() => {
    const start = setTimeout(() => {
      t.value = withTiming(1, {
        duration: piece.duration,
        easing: Easing.out(Easing.quad),
      });
    }, piece.delay);
    return () => clearTimeout(start);
  }, [piece, t]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    const translateX = piece.vx * p;
    const translateY = piece.vy0 * p + piece.gravity * p * p;
    const fadeIn = Math.min(p * 12, 1);
    const fadeOut = 1 - Math.max(0, (p - 0.7) / 0.3);
    return {
      opacity: fadeIn * fadeOut,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${piece.rotation * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: piece.originX,
          top: piece.originY,
          width: piece.size,
          height: piece.size * 1.6,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    borderRadius: 1.5,
  },
});
