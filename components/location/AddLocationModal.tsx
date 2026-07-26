import { useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing, typography } from '@/lib/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 500;

type Place = {
  identifier: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

type Props = {
  visible: boolean;
  place: Place | null;
  onCancel: () => void;
  onConfirm: (place: Place) => Promise<void>;
};

export function AddLocationModal({ visible, place, onCancel, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const panGesture = Gesture.Pan()
    .enabled(!submitting)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldDismiss =
        e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 200 },
          (finished) => {
            if (finished) runOnJS(onCancel)();
          },
        );
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleAdd = async () => {
    if (!place || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(place);
    } catch (e) {
      const message = toUserMessage(e, 'Try again.');
      Alert.alert('Could not add location', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.handle} />
              {place ? (
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={2}>
                    {place.name}
                  </Text>
                  {place.address ? (
                    <Text style={styles.address} numberOfLines={2}>
                      {place.address}
                    </Text>
                  ) : null}
                  <Text style={styles.helper} numberOfLines={3}>
                    You'll get notified when you arrive at {place.name}.
                  </Text>
                  <View style={styles.mapWrap}>
                    <MapView
                      provider={PROVIDER_DEFAULT}
                      style={styles.map}
                      initialRegion={{
                        latitude: place.latitude,
                        longitude: place.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      scrollEnabled={false}
                      zoomEnabled={false}
                    >
                      <Marker
                        coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                      />
                    </MapView>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={onCancel}
                      disabled={submitting}
                      style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleAdd()}
                      disabled={submitting}
                      style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.addText}>{submitting ? 'Adding…' : 'Add Location'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
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
    marginBottom: spacing.sm,
  },
  body: { gap: spacing.xs, paddingBottom: spacing.sm },
  name: { ...typography.display, fontSize: 22, fontWeight: '700' },
  address: { ...typography.caption, fontSize: 14 },
  helper: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  mapWrap: {
    marginTop: spacing.sm,
    height: 240,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.cardElevated,
  },
  map: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
  },
  cancelText: { ...typography.bodyStrong, fontSize: 16 },
  addBtn: {
    flex: 1.6,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
  },
  addText: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.bg,
  },
  pressed: { opacity: 0.6 },
});
