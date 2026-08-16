import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareTargetButton } from '@/components/photo-detail/ShareTargetButton';
import {
  captureShareCard,
  saveToPhotos,
  shareToInstagramStory,
  shareViaSystem,
} from '@/lib/share';
import { toUserMessage } from '@/lib/errors';
import { getSignedUrls } from '@/lib/storage';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { useWorkouts } from '@/lib/workouts';

export default function ShareSweatcamScreen() {
  const router = useRouter();
  const { id, primary } = useLocalSearchParams<{ id: string; primary?: string }>();
  const { workouts } = useWorkouts();
  const workout = workouts.find((w) => w.id === id);

  const [uriMap, setUriMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!workout) return;
    let cancelled = false;
    const paths = [workout.selfie_path, workout.environment_path].filter(
      (p): p is string => Boolean(p),
    );
    getSignedUrls(paths).then((map) => {
      if (!cancelled) setUriMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [workout]);

  useEffect(() => {
    if (!workout) router.back();
  }, [workout, router]);

  if (!workout) return <View style={styles.container} />;

  const selfieUri = uriMap[workout.selfie_path];
  const environmentUri = workout.environment_path
    ? uriMap[workout.environment_path]
    : null;
  // The caller passes whichever photo it was showing large, so the exported
  // card matches what the user was looking at.
  const swapped = primary === 'environment' && Boolean(environmentUri);
  const mainUri = swapped ? environmentUri : selfieUri;
  const insetUri = swapped ? selfieUri : environmentUri;
  // Storage paths pair with the URIs above so each image keeps a stable
  // expo-image cache key across launches. See lib/storage.ts.
  const selfiePath = workout.selfie_path;
  const environmentPath = workout.environment_path ?? null;
  const mainPath = swapped ? environmentPath : selfiePath;
  const insetPath = swapped ? selfiePath : environmentPath;
  const ready = Boolean(mainUri);

  const runShare = async (
    fn: (fileUri: string) => Promise<void>,
    successMessage?: string,
  ) => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const fileUri = await captureShareCard(cardRef);
      await fn(fileUri);
      if (successMessage) Alert.alert(successMessage);
    } catch (err) {
      Alert.alert(
        'Could not share',
        toUserMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.chrome}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.cardWrap}>
        <View ref={cardRef} collapsable={false} style={styles.card}>
          {mainUri ? (
            <Image
              source={{ uri: mainUri, cacheKey: mainPath ?? mainUri }}
              style={styles.selfie}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={styles.selfie} />
          )}

          {insetUri ? (
            <View style={styles.envWrap}>
              <Image
                source={{ uri: insetUri, cacheKey: insetPath ?? insetUri }}
                style={styles.env}
                contentFit="cover"
                transition={150}
              />
            </View>
          ) : null}

          <View style={styles.dateStamp}>
            <Text style={styles.dateLine}>{formatWeekday(workout.logged_at)}</Text>
            <Text style={styles.dateLine}>{formatMonthDay(workout.logged_at)}</Text>
          </View>
        </View>

        <Text style={styles.caption} numberOfLines={2}>
          {workout.caption ?? ' '}
        </Text>
        <View style={styles.sweatbudsRow}>
          <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
          <Text style={styles.sweatbudsText}>Sweatbuds</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <ShareTargetButton
          variant="messages"
          label="Messages"
          onPress={() => void runShare(shareViaSystem)}
        />
        <ShareTargetButton
          variant="instagram"
          label="IG Story"
          onPress={() => void runShare(shareToInstagramStory)}
        />
        <ShareTargetButton
          variant="save"
          label="Save"
          onPress={() =>
            void runShare(async (uri) => {
              await saveToPhotos(uri);
            }, 'Saved to your photo library.')
          }
        />
        <ShareTargetButton
          variant="more"
          label="More"
          onPress={() => void runShare(shareViaSystem)}
        />
      </View>

      {busy ? (
        <View style={styles.busyOverlay} pointerEvents="auto">
          <ActivityIndicator color={colors.text} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function formatWeekday(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();
}

function formatMonthDay(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    .toUpperCase();
}

const CARD_ASPECT = 4 / 5;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  chrome: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  card: {
    width: '100%',
    aspectRatio: CARD_ASPECT,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    position: 'relative',
  },
  selfie: { width: '100%', height: '100%' },
  envWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 70,
    height: 95,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bg,
    backgroundColor: colors.card,
  },
  env: { width: '100%', height: '100%' },
  dateStamp: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    alignItems: 'flex-end',
  },
  dateLine: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowRadius: 4,
  },
  caption: {
    ...typography.body,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  sweatbudsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sweatbudsText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
