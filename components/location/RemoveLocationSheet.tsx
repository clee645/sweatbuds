import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SavedLocation } from '@/types/db';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  visible: boolean;
  location: SavedLocation | null;
  onCancel: () => void;
  onConfirm: (location: SavedLocation) => Promise<void>;
};

export function RemoveLocationSheet({ visible, location, onCancel, onConfirm }: Props) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!location || removing) return;
    setRemoving(true);
    try {
      await onConfirm(location);
    } catch (e) {
      const message = toUserMessage(e, 'Try again.');
      Alert.alert('Could not remove location', message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.handle} />
            {location ? (
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={2}>
                  {location.name}
                </Text>
                <Pressable
                  onPress={() => void handleRemove()}
                  disabled={removing}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <Text style={styles.removeText}>
                    {removing ? 'Removing…' : 'Remove location'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </SafeAreaView>
        </Pressable>
      </Pressable>
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
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.md,
  },
  body: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  name: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  removeText: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.danger,
  },
  pressed: { opacity: 0.6 },
});
