import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PairingPanel } from '@/components/pairing/PairingPanel';
import { useAuth } from '@/lib/auth';
import { unpairPartnership } from '@/lib/invite';
import { usePartnership } from '@/lib/partnership';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { useWorkouts } from '@/lib/workouts';

export default function PartnerScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { partnership, partner, refresh: refreshPartnership } = usePartnership();
  const { refresh: refreshWorkouts } = useWorkouts();

  const isPaired = partnership?.status === 'active' && partner !== null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Partner</Text>
        <View style={styles.iconBtn} />
      </View>

      {isPaired ? (
        <PairedView
          partnerName={partner.display_name}
          partnerAvatar={partner.avatar_url}
          partnershipId={partnership.id}
          onUnpaired={async () => {
            await refreshPartnership();
            await refreshWorkouts();
          }}
        />
      ) : (
        <View style={styles.body}>
          <PairingPanel
            userId={user?.id ?? null}
            fillToShare
            onPaired={async (partnerName) => {
              await refreshPartnership();
              await refreshWorkouts();
              router.replace({
                pathname: '/pairing-celebration',
                params: partnerName ? { name: partnerName } : undefined,
              });
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

type PairedProps = {
  partnerName: string;
  partnerAvatar: string | null;
  partnershipId: string;
  onUnpaired: () => Promise<void>;
};

function PairedView({ partnerName, partnerAvatar, partnershipId, onUnpaired }: PairedProps) {
  const [unpairing, setUnpairing] = useState(false);
  const initial = partnerName.trim().charAt(0).toUpperCase() || '?';

  const confirmUnpair = () => {
    Alert.alert(
      'Unpair from partner?',
      `You'll stop sharing workouts with ${partnerName}. You can pair again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            setUnpairing(true);
            try {
              await unpairPartnership(partnershipId);
              await onUnpaired();
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Please try again.';
              Alert.alert('Could not unpair', message);
            } finally {
              setUnpairing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.body}>
      <View style={styles.partnerCard}>
        {partnerAvatar ? (
          <Image source={{ uri: partnerAvatar }} style={styles.partnerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.partnerAvatar, styles.partnerAvatarFallback]}>
            <Text style={styles.partnerAvatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.pairedLabel}>Paired with</Text>
        <Text style={styles.partnerName} numberOfLines={1}>
          {partnerName}
        </Text>
      </View>

      <View style={styles.bottomSpacer} />

      <Pressable
        onPress={confirmUnpair}
        disabled={unpairing}
        style={({ pressed }) => [
          styles.unpairBtn,
          pressed && styles.pressed,
          unpairing && styles.shareBtnDisabled,
        ]}
      >
        {unpairing ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={styles.unpairBtnText}>Unpair</Text>
        )}
      </Pressable>
    </View>
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
  headerTitle: { ...typography.bodyStrong, fontSize: 18 },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  bottomSpacer: { flex: 1 },
  shareBtnDisabled: { opacity: 0.5 },
  partnerCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginTop: spacing.xxl,
  },
  partnerAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.md,
  },
  partnerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerAvatarInitial: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  pairedLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  partnerName: {
    ...typography.display,
    color: colors.text,
  },
  unpairBtn: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  unpairBtnText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
