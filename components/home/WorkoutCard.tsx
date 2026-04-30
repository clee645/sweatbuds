import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

type Props = {
  selfieUri: string;
  environmentUri?: string | null;
  caption?: string | null;
  style?: StyleProp<ViewStyle>;
  envSize?: 'default' | 'large';
};

export function WorkoutCard({
  selfieUri,
  environmentUri,
  caption,
  style,
  envSize = 'default',
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <Image
        source={{ uri: selfieUri }}
        style={styles.selfie}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {environmentUri ? (
        <View
          style={[
            styles.envWrap,
            envSize === 'large' && styles.envWrapLarge,
          ]}
        >
          <Image
            source={{ uri: environmentUri }}
            style={styles.env}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
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
  selfie: { width: '100%', height: '100%' },
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
  env: { width: '100%', height: '100%' },
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
