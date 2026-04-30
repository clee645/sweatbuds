import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/lib/theme';

type Props = {
  title: string;
  blurb?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function ComingSoon({ title, blurb, icon = 'construct-outline' }: Props) {
  const navigation = useNavigation();

  const handleBack = () => {
    router.replace('/');
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.iconBtn} />
      </View>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={36} color={colors.accent} />
        </View>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.blurb}>
          {blurb ?? `${title} isn't ready yet — check back soon.`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.bodyStrong },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.display, textAlign: 'center' },
  blurb: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
