import * as Clipboard from 'expo-clipboard';
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

import {
  formatCode,
  getOrCreateInviteCode,
  isCompleteCode,
  normalizeCode,
  pairWithCode,
  sharePartnerInvite,
} from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  userId: string | null;
  onPaired: (partnerName: string | null) => Promise<void>;
  // Focus the code field on mount (used when the user taps "Enter a code").
  autoFocus?: boolean;
  // Push the "Share code" button to the bottom with a flex spacer. Used on the
  // full-screen Partner tab; omit inside the compact pairing sheet.
  fillToShare?: boolean;
};

// Self-contained pairing UI: enter a partner's code to pair, or share your own.
// Callback-driven (no navigation inside) so it can live on the Partner screen
// and inside the LockedHome pairing sheet alike.
export function PairingPanel({ userId, onPaired, autoFocus, fillToShare }: Props) {
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
      const updated = await pairWithCode(input);
      const otherUserId = updated.user_a === userId ? updated.user_b : updated.user_a;
      let partnerName: string | null = null;
      if (otherUserId) {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', otherUserId)
          .maybeSingle();
        partnerName = (data as { display_name?: string } | null)?.display_name ?? null;
      }
      await onPaired(partnerName);
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
            autoFocus={autoFocus}
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

      {fillToShare ? <View style={styles.bottomSpacer} /> : <View style={styles.gap} />}

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

const styles = StyleSheet.create({
  body: {
    flex: 1,
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
  gap: { height: spacing.xxl },
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
});
