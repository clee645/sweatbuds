import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export function BrandedSplash() {
  return (
    <View style={styles.container}>
      <Image source={require('../assets/ghost-mascot.png')} style={styles.ghost} />
      <Text style={styles.wordmark}>Sweatbuds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  ghost: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  wordmark: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
});
