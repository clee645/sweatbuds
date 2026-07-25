import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

export type HistoryView = 'weekly' | 'calendar';

type Props = {
  active: HistoryView;
  onChange: (next: HistoryView) => void;
};

// Floating bottom pill with two segments — list (weekly recap) on the left
// and calendar (month grid) on the right. The active segment fills white;
// the inactive sits transparent so the pill reads as a single capsule.
export function ViewToggle({ active, onChange }: Props) {
  return (
    <View style={styles.pill}>
      <Segment
        icon="list-outline"
        active={active === 'weekly'}
        onPress={() => onChange('weekly')}
      />
      <Segment
        icon="calendar-outline"
        active={active === 'calendar'}
        onPress={() => onChange('calendar')}
      />
    </View>
  );
}

function Segment({
  icon,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && !active && styles.segmentPressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? colors.bg : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    width: 56,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.text,
  },
  segmentPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
});
