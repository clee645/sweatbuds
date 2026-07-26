import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlwaysAllowIllustration } from '@/components/location/AlwaysAllowIllustration';
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

            <AlwaysAllowIllustration />

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
