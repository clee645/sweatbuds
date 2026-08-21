import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PhoneFrame,
  STEP_LAYOUTS,
  SuccessLayout,
} from '@/components/widget/WidgetMockups';
import { mutedCaption, WidgetStepCaption } from '@/components/widget/WidgetStepCaption';
import { WidgetStepDots } from '@/components/widget/WidgetStepDots';
import { colors, radii, spacing, typography } from '@/lib/theme';

const TOTAL_PAGES = STEP_LAYOUTS.length;

export default function WidgetHelpScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    const clamped = Math.max(0, Math.min(TOTAL_PAGES - 1, next));
    if (clamped !== page) setPage(clamped);
  };

  if (enabled) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.iconBtn} />
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.successBody}>
          <Text style={styles.title}>Your widget is set up</Text>
          <View style={styles.phoneWrap}>
            <PhoneFrame glowing>
              <SuccessLayout />
            </PhoneFrame>
          </View>
          <Text style={styles.captionMuted}>
            Hold down on any app{'\n'}to edit your Home Screen
          </Text>
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.finishBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.finishText}>Finish</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Widget Setup</Text>
        <View style={styles.iconBtn} />
      </View>

      <Text style={styles.title}>Add the widget to{'\n'}your home screen</Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.pager}
      >
        {STEP_LAYOUTS.map((Layout, i) => (
          <View key={i} style={[styles.slide, { width: screenWidth }]}>
            <PhoneFrame tilted={i === 0}>
              <Layout />
            </PhoneFrame>
          </View>
        ))}
      </ScrollView>

      <View style={styles.captionRow}>
        <WidgetStepCaption step={page} />
      </View>

      <WidgetStepDots page={page} total={TOTAL_PAGES} />

      <View style={styles.bottomBar}>
        {page === TOTAL_PAGES - 1 ? (
          <Pressable
            onPress={() => setEnabled(true)}
            style={({ pressed }) => [styles.enabledBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.enabledText}>I&apos;ve enabled the widget</Text>
          </Pressable>
        ) : null}
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
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.bodyStrong, fontSize: 18 },

  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  pager: { flexGrow: 0 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },

  captionRow: {
    paddingHorizontal: spacing.xxl,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  captionMuted: mutedCaption,

  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    minHeight: 76,
    justifyContent: 'flex-end',
  },
  enabledBtn: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  enabledText: { ...typography.bodyStrong, fontSize: 16, color: colors.textMuted },
  finishBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  finishText: { ...typography.bodyStrong, fontSize: 17, color: colors.text },
  btnPressed: { opacity: 0.85 },

  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  phoneWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
});
