import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '@/lib/theme';

// A mock of the iOS "Allow Location Access" picker with "Always" ticked, so we
// can point at the exact row the user needs to select in Settings. Shown by
// DowngradeSheet (they had Always and lost it) and by GateScreen when the user
// is on "While Using the App" — both cases need the same instruction.
//
// The palette is hardcoded iOS system light-mode rather than app theme colors:
// this is deliberately a picture of Settings, not a Sweatbuds surface.
export function AlwaysAllowIllustration() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Allow Location Access</Text>
      <View style={styles.options}>
        <View style={styles.row}>
          <Text style={styles.rowText}>Never</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowText}>Ask Next Time Or When I Share</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowText}>While Using the App</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowText}>Always</Text>
          <Ionicons name="checkmark" size={18} color="#0A84FF" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EFEFF4',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    color: '#6E6E73',
    textTransform: 'none',
    paddingHorizontal: spacing.sm,
  },
  options: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: {
    color: '#000000',
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: spacing.md,
  },
});
