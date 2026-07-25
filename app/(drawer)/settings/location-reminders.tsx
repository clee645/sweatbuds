import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DowngradeSheet } from '@/components/location/DowngradeSheet';
import { GateScreen } from '@/components/location/GateScreen';
import { ManagerScreen } from '@/components/location/ManagerScreen';
import { useLocationPermission } from '@/lib/location/useLocationPermission';
import { colors, spacing, typography } from '@/lib/theme';

export default function LocationRemindersRoute() {
  const { level, loading, refresh } = useLocationPermission();
  const [wasAlwaysThisSession, setWasAlwaysThisSession] = useState(false);

  useEffect(() => {
    if (level === 'always') setWasAlwaysThisSession(true);
  }, [level]);

  useFocusEffect(
    useCallback(() => {
      return () => setWasAlwaysThisSession(false);
    }, []),
  );

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>Coming soon on Android</Text>
          <Text style={styles.placeholderBody}>
            Location reminders are iOS-only for now.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top', 'bottom']} />;
  }

  if (level === 'always') {
    return <ManagerScreen />;
  }

  if (wasAlwaysThisSession) {
    return (
      <>
        <ManagerScreen />
        <DowngradeSheet visible />
      </>
    );
  }

  return <GateScreen onPermissionMaybeChanged={refresh} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  placeholderTitle: { ...typography.bodyStrong, fontSize: 18 },
  placeholderBody: { ...typography.caption, textAlign: 'center' },
});
