import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

type Props = {
  letter: string; // 'M' | 'T' | 'W' | ...
  dayNumber: number;
  imageUri: string | null;
  // Storage path behind `imageUri`, used as the stable expo-image cache key —
  // the signed URL's token changes every launch. See lib/storage.ts.
  imagePath: string | null;
  // Calendar date (YYYY-MM-DD, couple's zone) this cell represents. Tapping a
  // photo cell opens the same immersive memory viewer as the monthly grid.
  isoDate: string;
  // A day later than today within the in-progress week. Dimmed so an upcoming
  // day is distinguishable from one that was missed.
  future?: boolean;
};

// Single cell in a WeekCard's seven-day strip. Renders the day-of-week letter
// header above either a photo thumbnail (with the date overlaid) or a muted
// date number.
export function DayThumbnail({
  letter,
  dayNumber,
  imageUri,
  imagePath,
  isoDate,
  future,
}: Props) {
  const router = useRouter();

  return (
    <View style={[styles.column, future && styles.future]}>
      <Text style={styles.letter}>{letter}</Text>
      {imageUri ? (
        <Pressable
          onPress={() => router.push(`/history/day/${isoDate}`)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <Image
            source={{ uri: imageUri, cacheKey: imagePath ?? imageUri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.numberOverlay} pointerEvents="none">
            <Text style={styles.numberOnImage}>{dayNumber}</Text>
          </View>
        </Pressable>
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
  future: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
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
