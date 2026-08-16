import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

export type PhotoPrimary = 'selfie' | 'environment';

type Props = {
  // Sources rather than bare URIs so each image carries its stable cacheKey.
  // See `workoutImageSource` in lib/storage.ts.
  selfie: ImageSource;
  environment?: ImageSource | null;
  caption?: string | null;
  style?: StyleProp<ViewStyle>;
  envSize?: 'default' | 'large' | 'compact';
  showCommentIcon?: boolean;
  unreadCount?: number;
  primary?: PhotoPrimary;
  onSwap?: () => void;
};

export function WorkoutCard({
  selfie,
  environment,
  caption,
  style,
  envSize = 'default',
  showCommentIcon = false,
  unreadCount = 0,
  primary = 'selfie',
  onSwap,
}: Props) {
  // Fall back to selfie-as-main whenever there's no environment shot — plenty of
  // workouts have a null environment_path.
  const swapped = primary === 'environment' && Boolean(environment);
  const mainSource = swapped ? environment! : selfie;
  const insetSource = swapped ? selfie : environment;
  const canSwap = Boolean(environment && onSwap);

  return (
    <View style={[styles.card, style]}>
      <Image
        source={mainSource}
        style={styles.main}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {insetSource ? (
        <Pressable
          onPress={onSwap}
          disabled={!canSwap}
          // Without a swap handler this must be as touch-transparent as the
          // plain View it replaced — the home carousel wraps the card in a
          // GestureDetector whose tap opens the detail screen.
          pointerEvents={canSwap ? 'auto' : 'none'}
          hitSlop={6}
          style={({ pressed }) => [
            styles.envWrap,
            envSize === 'large' && styles.envWrapLarge,
            envSize === 'compact' && styles.envWrapCompact,
            pressed && canSwap && styles.envPressed,
          ]}
        >
          <Image
            source={insetSource}
            style={styles.env}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </Pressable>
      ) : null}

      {showCommentIcon ? (
        <View style={styles.commentBadge} pointerEvents="none">
          <Ionicons name="chatbox-outline" size={18} color="#FFFFFF" />
          {unreadCount > 0 ? (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadCount} numberOfLines={1}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {caption ? (
        <View style={styles.captionWrap} pointerEvents="none">
          <View style={styles.captionPill}>
            <Text style={styles.captionText} numberOfLines={1}>
              {caption}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    position: 'relative',
  },
  main: { width: '100%', height: '100%' },
  envWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 56,
    height: 76,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bg,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
  envWrapLarge: {
    width: 105,
    height: 140,
  },
  envWrapCompact: {
    width: 44,
    height: 60,
    borderRadius: radii.xs,
    top: spacing.sm,
    left: spacing.sm,
    borderWidth: 0.5,
  },
  envPressed: { opacity: 0.85 },
  env: { width: '100%', height: '100%' },
  commentBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.72)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    includeFontPadding: false,
  },
  captionWrap: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captionPill: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(230, 230, 232, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  captionText: {
    color: '#1C1C1E',
    fontSize: 13,
    fontWeight: '500',
  },
});
