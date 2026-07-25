import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, radii, spacing, typography } from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CHART_HEIGHT = 260;
const SAMPLES_PER_SEG = 16;

// Faint horizontal reference lines (normalized y) drawn behind the curves.
const GRID_LINES = [0.22, 0.5, 0.78];

// Sequenced motion: lines draw first, then the endpoint circles pop, then the
// labels settle in — roughly 2.2s total with ease-in-out timing.
const DRAW_DURATION = 1700;
const CIRCLE_DELAY = 1550;
const CIRCLE_DURATION = 320;
const LABEL_DELAY = 1780;
const LABEL_DURATION = 420;

// Normalized (0–1) control points. y is inverted: 0 = top, 1 = bottom.
// Both lines share the same left-edge start point so they animate out of it.
const WITH_SWEATBUDS = [
  [0.04, 0.46],
  [0.32, 0.4],
  [0.62, 0.32],
  [0.96, 0.2],
];
// Logistic-decay S-curve: a near-level shoulder, a steep drop through the
// middle inflection, then a flat tail near the bottom.
const WILLPOWER = [
  [0.04, 0.46],
  [0.3, 0.49],
  [0.52, 0.69],
  [0.76, 0.87],
  [0.96, 0.9],
];

// Cubic Bézier evaluated at t.
function cubicAt(
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  t: number,
): number[] {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

// Sample the Catmull-Rom curve through `points` into a dense polyline so the
// draw-on animation can reveal it point by point.
function sampleCurve(points: number[][]): number[][] {
  const out: number[][] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let s = 1; s <= SAMPLES_PER_SEG; s++) {
      out.push(cubicAt(p1, c1, c2, p2, s / SAMPLES_PER_SEG));
    }
  }
  return out;
}

const SWEAT_SAMPLES = sampleCurve(WITH_SWEATBUDS);
const WILL_SAMPLES = sampleCurve(WILLPOWER);
const SWEAT_END = SWEAT_SAMPLES[SWEAT_SAMPLES.length - 1];
const WILL_END = WILL_SAMPLES[WILL_SAMPLES.length - 1];

// Builds the SVG path for the portion of `samples` revealed at progress `p`.
function buildPath(samples: number[][], p: number, w: number, h: number): string {
  'worklet';
  const n = samples.length;
  const exact = p * (n - 1);
  const idx = Math.floor(exact);
  const frac = exact - idx;
  let d = `M ${samples[0][0] * w} ${samples[0][1] * h}`;
  for (let i = 1; i <= idx; i++) {
    d += ` L ${samples[i][0] * w} ${samples[i][1] * h}`;
  }
  if (idx < n - 1) {
    const a = samples[idx];
    const b = samples[idx + 1];
    d += ` L ${(a[0] + (b[0] - a[0]) * frac) * w} ${(a[1] + (b[1] - a[1]) * frac) * h}`;
  }
  return d;
}

// Like buildPath, but closes the revealed line down to the baseline and back
// so it can be filled with a gradient. Reveals in sync with the line draw.
function buildAreaPath(
  samples: number[][],
  p: number,
  w: number,
  h: number,
): string {
  'worklet';
  if (p <= 0) return '';
  const n = samples.length;
  const exact = p * (n - 1);
  const idx = Math.floor(exact);
  const frac = exact - idx;
  const startX = samples[0][0] * w;
  let d = `M ${startX} ${samples[0][1] * h}`;
  let tipX = startX;
  for (let i = 1; i <= idx; i++) {
    tipX = samples[i][0] * w;
    d += ` L ${tipX} ${samples[i][1] * h}`;
  }
  if (idx < n - 1) {
    const a = samples[idx];
    const b = samples[idx + 1];
    tipX = (a[0] + (b[0] - a[0]) * frac) * w;
    d += ` L ${tipX} ${(a[1] + (b[1] - a[1]) * frac) * h}`;
  }
  return `${d} L ${tipX} ${h} L ${startX} ${h} Z`;
}

// Animated "consistency over time" chart for onboarding screen 3. Both lines
// draw out of the shared left-edge point when the screen mounts, then the
// endpoint circles and labels arrive as finishing touches.
export function ConsistencyChart() {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const endReveal = useSharedValue(0);
  const labelReveal = useSharedValue(0);
  const hasAnimated = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (width <= 0 || hasAnimated.current) return;
    hasAnimated.current = true;
    progress.value = 0;
    endReveal.value = 0;
    labelReveal.value = 0;
    progress.value = withTiming(1, {
      duration: DRAW_DURATION,
      easing: Easing.inOut(Easing.cubic),
    });
    endReveal.value = withDelay(
      CIRCLE_DELAY,
      withTiming(1, {
        duration: CIRCLE_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );
    labelReveal.value = withDelay(
      LABEL_DELAY,
      withTiming(1, {
        duration: LABEL_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [width, progress, endReveal, labelReveal]);

  const w = width;
  const h = CHART_HEIGHT;

  const sweatAreaProps = useAnimatedProps(() => ({
    d: buildAreaPath(SWEAT_SAMPLES, progress.value, w, h),
  }));
  const willAreaProps = useAnimatedProps(() => ({
    d: buildAreaPath(WILL_SAMPLES, progress.value, w, h),
  }));
  const sweatPathProps = useAnimatedProps(() => ({
    d: buildPath(SWEAT_SAMPLES, progress.value, w, h),
  }));
  const willPathProps = useAnimatedProps(() => ({
    d: buildPath(WILL_SAMPLES, progress.value, w, h),
  }));
  const sweatDotProps = useAnimatedProps(() => ({
    opacity: endReveal.value,
    r: 5 * (0.4 + 0.6 * endReveal.value),
  }));
  const willDotProps = useAnimatedProps(() => ({
    opacity: endReveal.value,
    r: 4 * (0.4 + 0.6 * endReveal.value),
  }));

  const sweatLabelStyle = useAnimatedStyle(() => ({
    opacity: labelReveal.value,
    transform: [{ translateY: -6 + 6 * labelReveal.value }],
  }));
  const willLabelStyle = useAnimatedStyle(() => ({
    opacity: labelReveal.value,
    transform: [{ translateY: 6 - 6 * labelReveal.value }],
  }));

  return (
    <View>
      <View style={styles.plot} onLayout={onLayout}>
        {w > 0 ? (
          <Svg width={w} height={h}>
            <Defs>
              <LinearGradient id="sweatFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="willFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.textDim} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.textDim} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {GRID_LINES.map((gy) => (
              <Line
                key={gy}
                x1={0}
                y1={gy * h}
                x2={w}
                y2={gy * h}
                stroke={colors.borderSoft}
                strokeWidth={1}
              />
            ))}

            <AnimatedPath
              animatedProps={sweatAreaProps}
              fill="url(#sweatFill)"
              stroke="none"
            />
            <AnimatedPath
              animatedProps={willAreaProps}
              fill="url(#willFill)"
              stroke="none"
            />

            <AnimatedPath
              animatedProps={willPathProps}
              stroke={colors.textDim}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <AnimatedPath
              animatedProps={sweatPathProps}
              stroke={colors.accent}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            <AnimatedCircle
              animatedProps={willDotProps}
              cx={WILL_END[0] * w}
              cy={WILL_END[1] * h}
              fill={colors.textDim}
            />
            <AnimatedCircle
              animatedProps={sweatDotProps}
              cx={SWEAT_END[0] * w}
              cy={SWEAT_END[1] * h}
              fill={colors.accent}
            />
          </Svg>
        ) : null}

        <Animated.View style={[styles.sweatLabel, sweatLabelStyle]}>
          <Text style={styles.sweatLabelText}>With Sweatbuds</Text>
        </Animated.View>
        <Animated.View style={[styles.willLabel, willLabelStyle]}>
          <Text style={styles.willLabelText}>Willpower alone</Text>
        </Animated.View>
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText}>Month 1</Text>
        <Text style={styles.axisText}>Month 3</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  sweatLabel: {
    position: 'absolute',
    top: 2,
    right: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 7,
  },
  sweatLabelText: {
    ...typography.micro,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  willLabel: {
    position: 'absolute',
    bottom: 34,
    right: spacing.sm,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 7,
  },
  willLabelText: {
    ...typography.micro,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  axisText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textDim,
  },
});
