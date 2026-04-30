import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, radii, spacing } from '@/lib/theme';

export type PostPrimary = 'selfie' | 'environment';

type Props = {
  selfieUri: string;
  environmentUri: string;
  caption?: string | null;
  primary?: PostPrimary;
  onSwap?: () => void;
  onRemove?: () => void;
  captionSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle> | any;
};

export function PostComposition({
  selfieUri,
  environmentUri,
  caption,
  primary = 'selfie',
  onSwap,
  onRemove,
  captionSlot,
  style,
}: Props) {
  const primaryUri = primary === 'selfie' ? selfieUri : environmentUri;
  const thumbUri = primary === 'selfie' ? environmentUri : selfieUri;

  return (
    <Animated.View style={[styles.card, style]}>
      <Image
        source={{ uri: primaryUri }}
        style={styles.primary}
        contentFit="cover"
        transition={200}
      />

      <Pressable
        onPress={onSwap}
        disabled={!onSwap}
        style={({ pressed }) => [styles.thumbWrap, pressed && onSwap && styles.thumbPressed]}
        hitSlop={6}
      >
        <Image source={{ uri: thumbUri }} style={styles.thumb} contentFit="cover" />
      </Pressable>

      {onRemove ? (
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.text} />
        </Pressable>
      ) : null}

      {captionSlot ? (
        <View style={styles.captionSlotWrap} pointerEvents="box-none">
          {captionSlot}
        </View>
      ) : caption ? (
        <View style={styles.captionWrap} pointerEvents="none">
          <View style={styles.captionPill}>
            <Text style={styles.captionText} numberOfLines={1}>
              {caption}
            </Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 3 / 4,
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    position: 'relative',
  },
  primary: { width: '100%', height: '100%' },
  thumbWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 92,
    height: 124,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bg,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
  thumbPressed: { opacity: 0.85 },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 20, 20, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captionPill: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  captionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  captionSlotWrap: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
