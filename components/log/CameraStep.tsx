import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
  type FlashMode,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Phase = 'idle' | 'selfie' | 'environment';

type Props = {
  active: boolean;
  onCapturesComplete: (input: { selfieUri: string; environmentUri: string }) => void;
};

const REPOSITION_MS = 1000;
const POST_READY_SETTLE_MS = 300;
const CAPTURE_TIMEOUT_MS = 8000;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAMERA_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

// Capture failures are internal-detail errors ("Camera ref lost after lens
// flip"), so map them to copy a user can act on rather than surfacing raw
// Error.message. Timeouts get their own line because the fix differs — the
// user waited ~9s and needs to know it's worth retrying.
function captureErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : '';
  if (raw.includes('timed out')) {
    return "Camera timed out. Check that nothing else is using it, then try again.";
  }
  return "Couldn't capture. Hold steady and try again.";
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function CameraStep({ active, onCapturesComplete }: Props) {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [phase, setPhase] = useState<Phase>('idle');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const cameraReadyResolveRef = useRef<(() => void) | null>(null);
  const cameraReadyRef = useRef<boolean>(false);
  const prevActiveRef = useRef<boolean>(active);

  // Stable promise that resolves when CameraView reports ready for the
  // currently mounted facing direction.
  const waitForCameraReady = useCallback(() => {
    if (cameraReadyRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      cameraReadyResolveRef.current = resolve;
    });
  }, []);

  const handleCameraReady = useCallback(() => {
    cameraReadyRef.current = true;
    if (cameraReadyResolveRef.current) {
      cameraReadyResolveRef.current();
      cameraReadyResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // The CameraView has key={facing} so it fully remounts on lens flip.
  // Reset both readiness flags AND any pending resolver so the next
  // waitForCameraReady awaits the new instance's onCameraReady fire.
  useEffect(() => {
    cameraReadyRef.current = false;
    cameraReadyResolveRef.current = null;
  }, [facing]);

  // When the parent reactivates this step (user came back from preview via
  // retake), reset the capture state so the user can start over from selfie.
  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = active;
    if (!prev && active) {
      setPhase('idle');
      setFacing('front');
      setCaptureError(null);
    }
  }, [active]);

  const handleShutter = useCallback(async () => {
    if (phase !== 'idle') return;
    if (!cameraRef.current) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCaptureError(null);
      setPhase('selfie');

      await waitForCameraReady();
      // Small settle so AF/AE has stabilized after preview start.
      await new Promise((r) => setTimeout(r, POST_READY_SETTLE_MS));
      const selfie = await withTimeout(
        cameraRef.current.takePictureAsync({ quality: 0.9 }),
        CAPTURE_TIMEOUT_MS,
        'Selfie capture',
      );
      const selfieUri = selfie?.uri;
      if (!selfieUri) throw new Error('Selfie capture failed');

      // Switch to back camera; CameraView remounts on facing change.
      setPhase('environment');
      setFacing('back');

      await new Promise((resolve) => setTimeout(resolve, REPOSITION_MS));
      await waitForCameraReady();
      // After ready fires, give the back lens a moment to actually be capturable.
      // Without this settle, takePictureAsync can hang on iOS when called too soon.
      await new Promise((r) => setTimeout(r, POST_READY_SETTLE_MS));

      if (!cameraRef.current) throw new Error('Camera ref lost after lens flip');

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const env = await withTimeout(
        cameraRef.current.takePictureAsync({ quality: 0.9 }),
        CAPTURE_TIMEOUT_MS,
        'Environment capture',
      );
      const environmentUri = env?.uri;
      if (!environmentUri) throw new Error('Environment capture failed');

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCapturesComplete({ selfieUri, environmentUri });
    } catch (e) {
      // Reset so the user can try again. Without a visible message this reads
      // as a mis-tap — console.warn is stripped from release builds, so the
      // failure was previously invisible after a ~9s spinner.
      setPhase('idle');
      setFacing('front');
      setCaptureError(captureErrorMessage(e));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (__DEV__) console.warn('Capture failed', e);
    }
  }, [onCapturesComplete, phase, waitForCameraReady]);

  const handleFlip = useCallback(() => {
    if (phase !== 'idle') return;
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
  }, [phase]);

  // Dev-only escape hatch for the simulator (which has no working camera): pick
  // a selfie + environment image from the photo library and feed them into the
  // same onCapturesComplete path the real capture flow uses.
  const handleDevUpload = useCallback(async () => {
    if (phase !== 'idle') return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo library access needed', 'Allow access to pick test images.');
        return;
      }

      const selfie = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (selfie.canceled || !selfie.assets?.[0]?.uri) return;

      const env = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (env.canceled || !env.assets?.[0]?.uri) return;

      onCapturesComplete({
        selfieUri: selfie.assets[0].uri,
        environmentUri: env.assets[0].uri,
      });
    } catch (e) {
      Alert.alert(
        'Could not add photos',
        toUserMessage(e, "Couldn't add those photos. Please try again."),
      );
    }
  }, [onCapturesComplete, phase]);

  const handleFlash = useCallback(() => {
    if (phase !== 'idle') return;
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  }, [phase]);

  const closeFlow = useCallback(() => {
    if (phase !== 'idle') return;
    router.back();
  }, [phase, router]);

  if (!permission) {
    return (
      <View style={styles.permissionWrap}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.permissionWrap}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Sweatbuds uses your camera to capture your workout selfie and environment.
          </Text>
          <Pressable
            onPress={() => {
              if (permission.canAskAgain) void requestPermission();
              else void Linking.openSettings();
            }}
            style={({ pressed }) => [styles.permissionBtn, pressed && styles.pressed]}
          >
            <Text style={styles.permissionBtnText}>
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Text>
          </Pressable>
          <Pressable onPress={closeFlow} hitSlop={10}>
            <Text style={styles.permissionCancel}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isCapturing = phase !== 'idle';
  const overlayLabel =
    phase === 'selfie'
      ? 'Capturing selfie…'
      : phase === 'environment'
        ? 'Capturing environment…'
        : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={closeFlow}
          disabled={isCapturing}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.wordmark}>Sweatbuds</Text>
        {__DEV__ ? (
          <Pressable
            onPress={handleDevUpload}
            disabled={isCapturing}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="image-outline" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.cameraWrap}>
        <View style={styles.cameraFrame}>
          <CameraView
            key={facing}
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            flash={flash}
            active={active}
            onCameraReady={handleCameraReady}
            mute
          />
          {isCapturing ? (
            <View style={styles.overlay} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.text} />
              <Text style={styles.overlayLabel}>{overlayLabel}</Text>
            </View>
          ) : null}
        </View>
        {captureError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {captureError}
          </Text>
        ) : null}
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          onPress={handleFlash}
          disabled={isCapturing}
          style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={30}
            color={isCapturing ? colors.textDim : colors.text}
          />
        </Pressable>

        <Pressable
          onPress={handleShutter}
          disabled={isCapturing}
          style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
          hitSlop={4}
        >
          {isCapturing ? (
            <ActivityIndicator size="large" color={colors.text} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        <Pressable
          onPress={handleFlip}
          disabled={isCapturing}
          style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons
            name="camera-reverse"
            size={30}
            color={isCapturing ? colors.textDim : colors.text}
          />
        </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl * 2 + spacing.md,
    paddingBottom: spacing.xs,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
  cameraWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cameraFrame: {
    width: CAMERA_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  overlayLabel: {
    ...typography.bodyStrong,
    color: colors.text,
    fontSize: 15,
  },
  // Matches the inline-error idiom PreviewStep uses for the very next step.
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    width: CAMERA_WIDTH,
    paddingTop: spacing.md,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl * 2 + spacing.lg,
  },
  sideBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterPressed: {
    transform: [{ scale: 0.95 }],
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.text,
  },
  pressed: { opacity: 0.6 },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  permissionTitle: {
    ...typography.title,
    textAlign: 'center',
  },
  permissionBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  permissionBtnText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  permissionCancel: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
