import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

type Props = {
  // null = empty cell (used for leading/trailing days outside the month)
  dayNumber: number | null;
  isoDate: string | null;
  imageUri: string | null;
};

// One cell in the BeReal-style monthly grid. Tapping a tile that has
// workouts opens the immersive memory viewer for that date.
export function CalendarDayTile({ dayNumber, isoDate, imageUri }: Props) {
  const router = useRouter();

  if (dayNumber === null) {
    return <View style={styles.cell} />;
  }

  const handlePress = () => {
    if (!isoDate || !imageUri) return;
    router.push(`/history/day/${isoDate}`);
  };

  if (imageUri) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
      >
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
      </Pressable>
    );
  }

  return (
    <View style={styles.cell}>
      <View style={styles.tileEmpty}>
        <Text style={styles.numberMuted}>{dayNumber}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    aspectRatio: 3 / 4,
  },
  pressed: { opacity: 0.7 },
  tile: {
    flex: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  tileEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Fill the tile and center its child so the photo-day number lands at the
  // same x/y as the muted number in an empty cell — keeps every row aligned.
  numberOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOnImage: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  numberMuted: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '500',
  },
});
