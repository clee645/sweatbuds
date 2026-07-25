import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CustomerInfo } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';
import { EditProfileModal } from '@/components/settings/EditProfileModal';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { TimezonePickerModal } from '@/components/settings/TimezonePickerModal';
import { useAuth } from '@/lib/auth';
import { usePartnership } from '@/lib/partnership';
import { restorePurchases } from '@/lib/revenuecat';
import { useSubscription } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/lib/theme';
import { getCurrentWeekStartDay } from '@/lib/week';
import { debugForcePartnerSync } from '@/lib/widget';

function providerLabel(provider: string | undefined): string {
  if (!provider) return 'Email';
  if (provider === 'email') return 'Email';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function cityFromZone(zone: string): string {
  const last = zone.split('/').pop() ?? zone;
  return last.replace(/_/g, ' ');
}

function renewalSubtitle(info: CustomerInfo | null): string | undefined {
  const ent = info?.entitlements.active['Sweatbuds Pro'];
  if (!ent) return undefined;
  if (!ent.expirationDate) return 'Lifetime';
  const date = new Date(ent.expirationDate);
  const label = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return ent.willRenew ? `Renews ${label}` : `Expires ${label}`;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { profile, user, signOut } = useAuth();
  const { partnership, partner } = usePartnership();
  const { customerInfo, isPro, refresh: refreshSubscription } = useSubscription();

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const displayName = profile?.display_name ?? 'Friend';
  const avatarUrl = profile?.avatar_url ?? undefined;
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';
  const provider = providerLabel(user?.app_metadata?.provider as string | undefined);
  const timezone = profile?.timezone ?? 'America/Los_Angeles';
  const weekStartDay = getCurrentWeekStartDay(partnership);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleBack = () => {
    router.replace('/');
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const accountAvatar = (
    <View style={styles.avatarStack}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
    </View>
  );

  const accountSubtitle = (
    <View style={styles.accountSubtitleRow}>
      <View style={styles.dot} />
      <Text style={styles.accountSubtitleText}>Signed in with {provider}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection label="Widget Setup">
          <SettingsRow
            icon="apps-outline"
            title="How to add the widget"
            onPress={() => router.push('/settings/widget-help')}
          />
          <SettingsRow
            icon="refresh-outline"
            title="Resync widget now"
            onPress={async () => {
              try {
                const result = await debugForcePartnerSync({
                  partner,
                  partnership,
                  weeklyTarget: partnership?.weekly_target ?? 3,
                });
                Alert.alert('Widget resync', result);
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                Alert.alert('Widget resync failed', message);
              }
            }}
          />
        </SettingsSection>

        <SettingsSection label="Notifications">
          <SettingsRow
            icon="notifications"
            iconBg={colors.accent}
            iconColor={colors.text}
            title="Turn on notifications"
            subtitle="Open iOS Settings → Sweatbuds → Notifications and enable Allow Notifications, Sounds, and Badges."
            onPress={() => void Linking.openSettings()}
          />
          <SettingsRow
            icon="paper-plane-outline"
            title="Send test push"
            subtitle="Verifies token + delivery"
            onPress={async () => {
              try {
                if (!user) return;
                const projectId = Constants.expoConfig?.extra?.eas?.projectId as
                  | string
                  | undefined;
                const tokenRes = await Notifications.getExpoPushTokenAsync(
                  projectId ? { projectId } : undefined,
                );
                const token = tokenRes.data;
                const { count } = await supabase
                  .from('device_tokens')
                  .select('user_id', { count: 'exact', head: true })
                  .eq('user_id', user.id);
                const res = await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: token,
                    title: 'Sweatbuds test',
                    body: 'If you see this, push is working.',
                    sound: 'default',
                  }),
                });
                const json = await res.json();
                Alert.alert(
                  'Push diagnostic',
                  `Token: …${token.slice(-10)}\nDB rows: ${count ?? '?'}\nResp: ${JSON.stringify(json).slice(0, 240)}`,
                );
              } catch (err) {
                Alert.alert(
                  'Push test failed',
                  err instanceof Error ? err.message : String(err),
                );
              }
            }}
          />
        </SettingsSection>

        <SettingsSection label="Account">
          <Pressable
            onPress={() => setEditProfileOpen(true)}
            style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]}
          >
            {accountAvatar}
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {displayName}
              </Text>
              {accountSubtitle}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        </SettingsSection>

        <SettingsSection label="Preferences">
          <SettingsRow
            icon="time-outline"
            title="Timezone"
            subtitle={cityFromZone(timezone)}
            onPress={() => setTimezoneOpen(true)}
          />
          {partnership ? (
            <SettingsRow
              icon="calendar-outline"
              title="Week start day"
              subtitle={weekStartDay !== null ? DAY_NAMES[weekStartDay] : undefined}
              onPress={() => router.push('/settings/week-start-day')}
            />
          ) : null}
          <SettingsRow
            icon="location-outline"
            title="Location Reminders"
            subtitle="Get reminded to log a workout when you arrive at the gym."
            onPress={() => router.push('/settings/location-reminders')}
          />
        </SettingsSection>

        <SettingsSection label="Subscription">
          <SettingsRow
            icon={isPro ? 'checkmark-circle' : 'lock-closed'}
            iconBg={isPro ? colors.successSoft : colors.cardElevated}
            iconColor={isPro ? colors.success : colors.textMuted}
            title={isPro ? 'Active' : 'Not subscribed'}
            subtitle={renewalSubtitle(customerInfo)}
            accessory="none"
          />
          {isPro ? (
            <SettingsRow
              icon="card-outline"
              title="Manage Subscription"
              onPress={async () => {
                try {
                  await RevenueCatUI.presentCustomerCenter();
                  await refreshSubscription();
                } catch (err) {
                  Alert.alert(
                    'Could not open',
                    err instanceof Error ? err.message : String(err),
                  );
                }
              }}
            />
          ) : null}
          <SettingsRow
            icon="refresh"
            title="Restore Purchases"
            onPress={async () => {
              const result = await restorePurchases();
              if (result.kind === 'success') {
                await refreshSubscription();
                Alert.alert(
                  'Restore complete',
                  result.customerInfo.entitlements.active['Sweatbuds Pro']
                    ? 'Your subscription is active.'
                    : 'No active subscription found on this Apple ID.',
                );
              } else if (result.kind === 'error') {
                Alert.alert('Restore failed', result.message);
              }
            }}
          />
        </SettingsSection>

        <SettingsSection label="About">
          <SettingsRow
            icon="information-circle-outline"
            title={`Version ${version}`}
            accessory="text"
            accessoryText="Up to date"
          />
          <SettingsRow
            icon="lock-closed-outline"
            title="Privacy Policy"
            onPress={() => void Linking.openURL('https://sweatbuds.app/privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of Service"
            onPress={() => void Linking.openURL('https://sweatbuds.app/terms')}
          />
        </SettingsSection>

        <View style={styles.signOutSection}>
          <SettingsSection>
            <SettingsRow
              icon="log-out-outline"
              title="Sign Out"
              accessory="chevron"
              onPress={handleSignOut}
            />
          </SettingsSection>
        </View>

        <Pressable
          onPress={() => setDeleteOpen(true)}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal visible={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
      <TimezonePickerModal visible={timezoneOpen} onClose={() => setTimezoneOpen(false)} />
      <DeleteAccountModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.bodyStrong, fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  pressed: { opacity: 0.6 },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 76,
  },
  avatarStack: { width: 44, height: 44 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardElevated,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  accountText: { flex: 1, gap: 4 },
  accountName: { ...typography.bodyStrong, fontSize: 18 },
  accountSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  accountSubtitleText: { ...typography.caption },

  signOutSection: { marginTop: spacing.md },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  deleteText: {
    ...typography.bodyStrong,
    color: colors.danger,
    fontSize: 15,
  },
});

