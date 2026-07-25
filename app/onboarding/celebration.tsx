import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Particles } from '@/components/log/Particles';
import { colors } from '@/lib/theme';

const NEXT = '/onboarding/invite-partner' as const;

// Onboarding celebration moment — a glowing checkmark. Auto-advances; also
// tappable.
export default function CelebrationScreen() {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const timer = setTimeout(() => router.replace(NEXT), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable style={styles.root} onPress={() => router.replace(NEXT)}>
      <LinearGradient
        colors={['rgba(255, 90, 95, 0.28)', 'rgba(255, 90, 95, 0.06)', 'rgba(0, 0, 0, 0)']}
        start={{ x: 0.5, y: 0.1 }}
        end={{ x: 0.5, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Particles />

      <View style={styles.center}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.glow}>
          <View style={styles.circle}>
            <Ionicons name="checkmark" size={64} color={colors.accent} />
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    borderRadius: 999,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  circle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
