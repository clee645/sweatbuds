import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, typography } from '@/lib/theme';

const ITEM_HEIGHT = 64;
// Viewport shows 5 rows; the selected value sits in the centre (row index 2),
// so 2 blank spacer rows are needed above and below the value list.
const VISIBLE = 5;
const PAD_ROWS = 2;

type Props = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
};

// Custom vertical wheel picker — scroll-snaps a value into the centre band.
export function DayWheelPicker({ value, onChange, min = 1, max = 7 }: Props) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const scrollRef = useRef<ScrollView>(null);
  const [selectedIndex, setSelectedIndex] = useState(
    Math.min(values.length - 1, Math.max(0, value - min)),
  );

  const settleTo = (offsetY: number) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    if (i !== selectedIndex) {
      setSelectedIndex(i);
      onChange(values[i]);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    settleTo(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.viewport}>
      {/* Centre band divider lines. */}
      <View style={[styles.divider, { top: PAD_ROWS * ITEM_HEIGHT }]} pointerEvents="none" />
      <View
        style={[styles.divider, { top: (PAD_ROWS + 1) * ITEM_HEIGHT }]}
        pointerEvents="none"
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onScroll}
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
      >
        {Array.from({ length: PAD_ROWS }).map((_, i) => (
          <View key={`top-${i}`} style={styles.row} />
        ))}

        {values.map((n, i) => {
          const dist = Math.abs(i - selectedIndex);
          return (
            <View key={n} style={styles.row}>
              <Text
                style={[
                  styles.number,
                  dist === 0 && styles.numberSelected,
                  dist === 1 && styles.numberNear,
                ]}
              >
                {n}
              </Text>
            </View>
          );
        })}

        {Array.from({ length: PAD_ROWS }).map((_, i) => (
          <View key={`bot-${i}`} style={styles.row} />
        ))}
      </ScrollView>

      {/* "days" sits just right of the centred number. */}
      <View style={styles.daysLabel} pointerEvents="none">
        <Text style={styles.daysText}>days</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    height: ITEM_HEIGHT * VISIBLE,
  },
  row: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 30,
    fontWeight: '600',
    color: colors.textDim,
  },
  numberNear: {
    fontSize: 34,
    color: colors.textMuted,
  },
  numberSelected: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.text,
  },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  daysLabel: {
    position: 'absolute',
    left: '50%',
    marginLeft: 26,
    top: PAD_ROWS * ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  daysText: {
    ...typography.display,
    fontSize: 30,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
