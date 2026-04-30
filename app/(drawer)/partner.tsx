import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import {
  formatCode,
  getOrCreateInviteCode,
  isCompleteCode,
  normalizeCode,
  pairWithCode,
  sharePartnerInvite,
  unpairPartnership,
} from '@/lib/invite';
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
        <UnpairedView
          userId={user?.id ?? null}
          onPaired={async () => {
            await refreshPartnership();
            await refreshWorkouts();
            router.replace('/');
          }}
        />
      )}
    </SafeAreaView>
  );
}

type UnpairedProps = {
  userId: string | null;
  onPaired: () => Promise<void>;
};

function UnpairedView({ userId, onPaired }: UnpairedProps) {
  const [input, setInput] = useState('');
  const [pairing, setPairing] = useState(false);
  const [ownCode, setOwnCode] = useState<string | null>(null);
  const [ownCodeLoading, setOwnCodeLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setOwnCode(null);
      setOwnCodeLoading(false);
      return;
    }
    setOwnCodeLoading(true);
    getOrCreateInviteCode(userId)
      .then((code) => {
        if (!cancelled) setOwnCode(code);
      })
      .catch(() => {
        if (!cancelled) setOwnCode(null);
      })
      .finally(() => {
        if (!cancelled) setOwnCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleChange = (raw: string) => {
    const normalized = normalizeCode(raw);
    setInput(formatCode(normalized));
  };

  const canPair = !pairing && isCompleteCode(input);

  const handlePair = async () => {
    if (!userId || !canPair) return;
    setPairing(true);
    try {
      await pairWithCode(userId, input);
      await onPaired();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not pair', message);
    } finally {
      setPairing(false);
    }
  };

  const handleCopyOwnCode = async () => {
    if (!ownCode) return;
    await Clipboard.setStringAsync(formatCode(ownCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    if (!userId) return;
    try {
      await sharePartnerInvite(userId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Alert.alert('Could not share invite', message);
    }
  };

  return (
    <View style={styles.body}>
      <View style={styles.topGroup}>
        <View style={styles.codeInputWrap}>
          <TextInput
            value={input}
            onChangeText={handleChange}
            placeholder="XX - XXXX"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            style={styles.codeInput}
            editable={!pairing}
          />
        </View>

        <View style={styles.pairRow}>
          <Text style={styles.pairCaption}>Enter partner's code</Text>
          <Pressable
            onPress={handlePair}
            disabled={!canPair}
            style={({ pressed }) => [
              styles.pairBtn,
              !canPair && styles.pairBtnDisabled,
              pressed && canPair && styles.pressed,
            ]}
            hitSlop={6}
          >
            {pairing ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.pairBtnText}>Pair</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Text style={styles.orText}>or</Text>

      <Pressable
        onPress={handleCopyOwnCode}
        disabled={!ownCode}
        style={({ pressed }) => [styles.codeCard, pressed && ownCode && styles.pressed]}
      >
        {ownCodeLoading ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : ownCode ? (
          <>
            <Text style={styles.codeCardText}>{formatCode(ownCode)}</Text>
            <Text style={styles.codeCardHint}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
          </>
        ) : (
          <Text style={styles.codeCardError}>Could not load code</Text>
        )}
      </Pressable>

      <View style={styles.bottomSpacer} />

      <Pressable
        onPress={handleShare}
        disabled={!ownCode}
        style={({ pressed }) => [
          styles.shareBtn,
          !ownCode && styles.shareBtnDisabled,
          pressed && ownCode && styles.pressed,
        ]}
      >
        <Text style={styles.shareBtnText}>Share code with partner</Text>
      </Pressable>
    </View>
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
  topGroup: {
    marginTop: spacing.xxl,
  },
  codeInputWrap: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    width: '100%',
    padding: 0,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  pairCaption: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 14,
  },
  pairBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairBtnDisabled: {
    backgroundColor: colors.cardElevated,
  },
  pairBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: { opacity: 0.7 },
  orText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.xxl,
  },
  codeCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
    gap: spacing.xs,
  },
  codeCardText: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 4,
  },
  codeCardHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  codeCardError: {
    ...typography.body,
    color: colors.textMuted,
  },
  bottomSpacer: { flex: 1 },
  shareBtn: {
    backgroundColor: colors.text,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareBtnText: {
    color: colors.bg,
    fontSize: 18,
    fontWeight: '700',
  },
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
