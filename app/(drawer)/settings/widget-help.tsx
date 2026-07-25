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

import { colors, radii, spacing, typography } from '@/lib/theme';

const PHONE_W = 220;
const PHONE_H = 400;
const APP_TILE = 30;
const APP_GAP = 8;
const TOTAL_PAGES = 4;

type Slide = 0 | 1 | 2 | 3;

export default function WidgetHelpScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [page, setPage] = useState<Slide>(0);
  const [enabled, setEnabled] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    const clamped = Math.max(0, Math.min(TOTAL_PAGES - 1, next)) as Slide;
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
        <View style={[styles.slide, { width: screenWidth }]}>
          <PhoneFrame tilted>
            <Slide1Layout />
          </PhoneFrame>
        </View>
        <View style={[styles.slide, { width: screenWidth }]}>
          <PhoneFrame>
            <Slide2Layout />
          </PhoneFrame>
        </View>
        <View style={[styles.slide, { width: screenWidth }]}>
          <PhoneFrame>
            <Slide3Layout />
          </PhoneFrame>
        </View>
        <View style={[styles.slide, { width: screenWidth }]}>
          <PhoneFrame>
            <Slide4Layout />
          </PhoneFrame>
        </View>
      </ScrollView>

      <View style={styles.captionRow}>
        <Caption page={page} />
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.bottomBar}>
        {page === 3 ? (
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

function Caption({ page }: { page: Slide }) {
  if (page === 0) {
    return (
      <Text style={styles.captionMuted}>
        Hold down on any app{'\n'}to edit your Home Screen
      </Text>
    );
  }
  if (page === 1) {
    return (
      <View style={styles.captionStack}>
        <View style={styles.captionInlineRow}>
          <Text style={styles.caption}>Tap the </Text>
          <View style={styles.captionEditPill}>
            <Text style={styles.captionEditPillText}>Edit</Text>
          </View>
          <Text style={styles.caption}> button</Text>
        </View>
        <Text style={styles.caption}>in the top left corner</Text>
      </View>
    );
  }
  if (page === 2) {
    return (
      <View style={styles.captionStack}>
        <View style={styles.captionInlineRow}>
          <Text style={styles.caption}>Tap </Text>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={[styles.caption, styles.accentInline]}> Add Widget</Text>
        </View>
        <Text style={styles.caption}>from the menu</Text>
      </View>
    );
  }
  return (
    <View style={styles.captionStack}>
      <Text style={styles.caption}>
        Search for <Text style={styles.accentInline}>Sweatbuds</Text>
      </Text>
      <Text style={styles.caption}>and add the widget</Text>
    </View>
  );
}

function PhoneFrame({
  glowing,
  tilted,
  children,
}: {
  glowing?: boolean;
  tilted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.phone,
        tilted && styles.phoneTilted,
        glowing && styles.phoneGlow,
      ]}
    >
      {children}
    </View>
  );
}

function AppGrid({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <View style={styles.gridWrap}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.gridRow}>
          {Array.from({ length: cols }).map((__, c) => (
            <View key={c} style={styles.appTile} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Slide1Layout() {
  return (
    <View style={styles.phoneInner}>
      <AppGrid />
    </View>
  );
}

function Slide2Layout() {
  return (
    <View style={styles.phoneInner}>
      <View style={styles.editBigPill}>
        <Text style={styles.editBigPillText}>Edit</Text>
      </View>
      <View style={styles.gridShifted}>
        <AppGrid />
      </View>
    </View>
  );
}

function Slide3Layout() {
  return (
    <View style={styles.phoneInnerMenu}>
      <View style={styles.menuCard}>
        <View style={[styles.menuRow, styles.menuRowHighlight]}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={[styles.menuText, styles.menuTextAccent]}>Add Widget</Text>
        </View>
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <Ionicons name="options-outline" size={16} color={colors.text} />
          <Text style={styles.menuText}>Customize</Text>
        </View>
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <Ionicons name="image-outline" size={16} color={colors.text} />
          <Text style={styles.menuText}>Edit Wallpaper</Text>
        </View>
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <Ionicons name="layers-outline" size={16} color={colors.text} />
          <Text style={styles.menuText}>Edit Pages</Text>
        </View>
      </View>
    </View>
  );
}

function Slide4Layout() {
  return (
    <View style={styles.phoneInnerSearch}>
      <View style={styles.searchField}>
        <Ionicons name="search" size={11} color={colors.textDim} />
        <Text style={styles.searchText}>Sweatbuds</Text>
      </View>
      <View style={styles.resultRow}>
        <View style={styles.resultIcon}>
          <Ionicons name="heart" size={16} color={colors.accent} />
        </View>
        <Text style={styles.resultText}>Sweatbuds</Text>
      </View>
      <View style={styles.widgetGridCard}>
        <View style={styles.widgetRow}>
          <View style={styles.widgetTile} />
          <View style={styles.widgetTile} />
        </View>
        <View style={styles.widgetRow}>
          <View style={styles.widgetTile} />
          <View style={styles.widgetTile} />
        </View>
      </View>
    </View>
  );
}

function SuccessLayout() {
  return (
    <View style={styles.phoneInner}>
      <View style={styles.successTopRow}>
        <View style={styles.bigWidgetTile} />
        <View style={styles.smallStack}>
          <View style={styles.gridRow}>
            <View style={styles.appTile} />
            <View style={styles.appTile} />
          </View>
          <View style={styles.gridRow}>
            <View style={styles.appTile} />
            <View style={styles.appTile} />
          </View>
        </View>
      </View>
      <View style={styles.gridWrap}>
        {Array.from({ length: 3 }).map((_, r) => (
          <View key={r} style={styles.gridRow}>
            {Array.from({ length: 4 }).map((__, c) => (
              <View key={c} style={styles.appTile} />
            ))}
          </View>
        ))}
      </View>
    </View>
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

  phone: {
    width: PHONE_W,
    height: PHONE_H,
    borderWidth: 5,
    borderColor: '#7E7E82',
    borderRadius: 36,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  phoneTilted: { transform: [{ rotate: '-5deg' }] },
  phoneGlow: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.85,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  phoneInner: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  phoneInnerMenu: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 16,
  },
  phoneInnerSearch: {
    flex: 1,
    paddingTop: 28,
    paddingHorizontal: 14,
    gap: 10,
  },

  gridWrap: { gap: APP_GAP },
  gridRow: { flexDirection: 'row', gap: APP_GAP },
  appTile: {
    width: APP_TILE,
    height: APP_TILE,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  gridShifted: { marginTop: spacing.sm },

  // Slide 2: Edit pill on phone
  editBigPill: {
    backgroundColor: '#1F1F22',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  editBigPillText: { ...typography.body, fontSize: 13, color: colors.text },

  // Slide 3: menu
  menuCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  menuRowHighlight: { backgroundColor: 'rgba(255, 90, 95, 0.18)' },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuText: { ...typography.body, fontSize: 13, color: colors.text },
  menuTextAccent: { color: colors.accent, fontWeight: '500' },

  // Slide 4: search + result + widget grid
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F1F22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  searchText: { ...typography.body, fontSize: 11, color: colors.textDim },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F0F11',
    borderRadius: 8,
    padding: 8,
  },
  resultIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { ...typography.bodyStrong, fontSize: 12 },
  widgetGridCard: {
    backgroundColor: '#1A1A1C',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  widgetRow: { flexDirection: 'row', gap: 8 },
  widgetTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
  },

  // Success layout
  successTopRow: {
    flexDirection: 'row',
    gap: APP_GAP,
    marginBottom: APP_GAP,
  },
  smallStack: { gap: APP_GAP },
  bigWidgetTile: {
    width: APP_TILE * 2 + APP_GAP,
    height: APP_TILE * 2 + APP_GAP,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: colors.accent,
  },

  // Captions
  captionRow: {
    paddingHorizontal: spacing.xxl,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  captionStack: { alignItems: 'center', gap: 4 },
  captionInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caption: {
    ...typography.bodyStrong,
    fontSize: 17,
    textAlign: 'center',
    color: colors.text,
  },
  captionMuted: {
    ...typography.bodyStrong,
    fontSize: 17,
    textAlign: 'center',
    color: colors.textMuted,
    lineHeight: 22,
  },
  captionEditPill: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  captionEditPillText: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  accentInline: { color: colors.accent },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textDim,
    opacity: 0.6,
  },
  dotActive: { backgroundColor: colors.text, opacity: 1 },

  // Bottom bar / buttons
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

  // Success body
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
