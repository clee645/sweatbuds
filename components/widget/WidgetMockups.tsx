import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';

// Fake iOS home-screen mockups used by the widget setup walkthrough. Drawn with
// plain views rather than screenshots so they follow the app's theme and never
// go stale against a new iOS build.
export const PHONE_W = 220;
export const PHONE_H = 400;
export const APP_TILE = 30;
export const APP_GAP = 8;

export function PhoneFrame({
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

export function AppGrid({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
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

export function Slide1Layout() {
  return (
    <View style={styles.phoneInner}>
      <AppGrid />
    </View>
  );
}

export function Slide2Layout() {
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

export function Slide3Layout() {
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

export function Slide4Layout() {
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

export function SuccessLayout() {
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

// The layout for a given zero-based walkthrough step.
export const STEP_LAYOUTS = [Slide1Layout, Slide2Layout, Slide3Layout, Slide4Layout];

const styles = StyleSheet.create({
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
});
