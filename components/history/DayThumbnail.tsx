import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

type Props = {
  letter: string; // 'M' | 'T' | 'W' | ...
  dayNumber: number;
  imageUri: string | null;
};

// Single cell in a WeekCard's seven-day strip. Renders the day-of-week letter
// header above either a photo thumbnail (with the date overlaid) or a muted
// date number.
export function DayThumbnail({ letter, dayNumber, imageUri }: Props) {
  return (
    <View style={styles.column}>
      <Text style={styles.letter}>{letter}</Text>
      {imageUri ? (
        <View style={styles.tile}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.numberOverlay} pointerEvents="none">
            <Text style={styles.numberOnImage}>{dayNumber}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.tile, styles.tileEmpty]}>
          <Text style={styles.numberMuted}>{dayNumber}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  letter: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  tile: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  tileEmpty: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fill the tile and center the number so a photo day's number lands at the
  // same x/y as a muted empty-day number across a row.
  numberOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOnImage: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  numberMuted: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});
