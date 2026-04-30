import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { sharePartnerInvite } from '@/lib/invite';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { DrawerItem } from './DrawerItem';

export function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const { profile, user } = useAuth();

  const navigate = (path: string) => {
    props.navigation.closeDrawer();
    router.push(path as never);
  };

  const handleInvite = async () => {
    props.navigation.closeDrawer();
    if (!user) return;
    try {
      await sharePartnerInvite(user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not create invite', message);
    }
  };

  const displayName = profile?.display_name ?? 'Friend';
  const avatarUrl = profile?.avatar_url ?? undefined;
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profilePill}>
          <View style={styles.avatarStack}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Pressable
              onPress={handleInvite}
              style={styles.invitePlus}
              hitSlop={6}
            >
              <Ionicons name="person-add" size={14} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.profileHint} numberOfLines={1}>
              Tap + to invite partner
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.group}>
          <DrawerItem
            icon="barbell-outline"
            label="Weekly Rules"
            onPress={() => navigate('/weekly-rules')}
          />
          <DrawerItem
            icon="locate-outline"
            label="Wager Balance"
            onPress={() => navigate('/wager-balance')}
          />
          <DrawerItem
            icon="heart-outline"
            label="Partner"
            onPress={() => navigate('/partner')}
          />
          <DrawerItem
            icon="calendar-outline"
            label="History"
            onPress={() => navigate('/history')}
          />
        </View>

        <Text style={styles.sectionLabel}>ACTIONS</Text>

        <View style={styles.group}>
          <DrawerItem
            icon="bulb-outline"
            label="Request a feature"
            onPress={() => navigate('/request-feature')}
          />
          <DrawerItem
            icon="headset-outline"
            label="Support"
            onPress={() => navigate('/support')}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <DrawerItem
          icon="settings-outline"
          label="Settings"
          onPress={() => navigate('/settings')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  avatarStack: {
    width: 56,
    height: 44,
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  invitePlus: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
  profileHint: {
    ...typography.caption,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.sm,
  },
  group: { gap: 2 },
  sectionLabel: {
    ...typography.micro,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
});
