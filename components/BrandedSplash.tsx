import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

export function BrandedSplash() {
  return (
    <View style={styles.container}>
      <Image source={require('../assets/ghost-mascot.png')} style={styles.ghost} />
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
    width: 132,
    height: 132,
    resizeMode: 'contain',
  },
});
