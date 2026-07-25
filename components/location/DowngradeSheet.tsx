import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  visible: boolean;
};

export function DowngradeSheet({ visible }: Props) {
  const openSettings = () => {
    void Linking.openSettings();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />

            <View style={styles.iosCard}>
              <Text style={styles.iosLabel}>Allow Location Access</Text>
              <View style={styles.iosOptions}>
                <View style={styles.iosRow}>
                  <Text style={styles.iosRowText}>Never</Text>
                </View>
                <View style={styles.iosDivider} />
                <View style={styles.iosRow}>
                  <Text style={styles.iosRowText}>Ask Next Time Or When I Share</Text>
                </View>
                <View style={styles.iosDivider} />
                <View style={styles.iosRow}>
                  <Text style={styles.iosRowText}>While Using the App</Text>
                </View>
                <View style={styles.iosDivider} />
                <View style={styles.iosRow}>
                  <Text style={styles.iosRowText}>Always</Text>
                  <Ionicons name="checkmark" size={18} color="#0A84FF" />
                </View>
              </View>
            </View>

            <View style={styles.copy}>
              <Text style={styles.heading}>Select "Always"{'\n'}to get location reminders</Text>
              <Text style={styles.sub}>so you never forget to log a workout</Text>
            </View>

            <Pressable
              onPress={openSettings}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Ionicons name="settings-outline" size={18} color={colors.bg} />
              <Text style={styles.ctaText}>Open Settings</Text>
            </Pressable>

            <Text style={styles.footer}>
              we don't track your location.{'\n'}apple just tells us when you arrive at your workout spots.
            </Text>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.lg,
  },
  iosCard: {
    backgroundColor: '#EFEFF4',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  iosLabel: {
    fontSize: 13,
    color: '#6E6E73',
    textTransform: 'none',
    paddingHorizontal: spacing.sm,
  },
  iosOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iosRowText: {
    color: '#000000',
    fontSize: 15,
  },
  iosDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: spacing.md,
  },
  copy: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heading: {
    ...typography.display,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  sub: {
    ...typography.caption,
    textAlign: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.pill,
  },
  ctaText: {
    ...typography.bodyStrong,
    fontSize: 17,
    color: colors.bg,
  },
  footer: {
    ...typography.caption,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  pressed: { opacity: 0.6 },
});
