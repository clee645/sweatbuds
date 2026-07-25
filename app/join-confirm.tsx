import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { SignaturePad, SignaturePadHandle } from '@/components/onboarding/SignaturePad';
import { usePartnership } from '@/lib/partnership';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Shown to the invitee right after their code is redeemed (see
// PendingInvitePairer). The weekly plan + wager belong to their partner, so
// instead of setting their own the invitee reviews the shared terms and signs
// to agree before the pairing celebration.
export default function JoinConfirmScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const { partnership, partner, consumeFreshlyPaired } = usePartnership();
  const padRef = useRef<SignaturePadHandle>(null);
  const [signed, setSigned] = useState(false);

  const partnerName =
    (typeof params.name === 'string' && params.name) || partner?.display_name || 'your partner';

  // Consume the fresh-pairing signal so the in-app "partner joined" toast
  // doesn't fire while the invitee is still on this screen — the pairing
  // celebration is the intended payoff and runs right after this.
  useEffect(() => {
    consumeFreshlyPaired();
  }, [consumeFreshlyPaired]);

  const target = partnership?.weekly_target ?? null;
  const wagerEmoji = partnership?.wager_emoji ?? null;
  const wagerQty = partnership?.wager_quantity ?? null;
  const wagerText = partnership?.wager_text ?? null;

  const handleAgree = () => {
    if (!signed) return;
    router.replace({
      pathname: '/pairing-celebration',
      params: typeof params.name === 'string' && params.name ? { name: params.name } : undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Here&apos;s the deal</Text>
          <Text style={styles.subtitle}>
            {partnerName} set the plan for the two of you. Agree to lock it in.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Weekly goal</Text>
            <Text style={styles.rowValue}>
              {target != null ? `${target} workout${target === 1 ? '' : 's'} / week` : '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>If you fall short</Text>
            <Text style={styles.rowValue}>
              {wagerQty != null && wagerText
                ? `${wagerEmoji ? `${wagerEmoji} ` : ''}${wagerQty} ${wagerText}`
                : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.middle}>
          <SignaturePad ref={padRef} style={styles.pad} onSignedChange={setSigned} />
          <Pressable onPress={() => padRef.current?.clear()} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear Signature</Text>
          </Pressable>
          <Text style={styles.hint}>Sign above to agree</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton
          label="Agree & join"
          variant="accent"
          disabled={!signed}
          onPress={handleAgree}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xxl,
  },
  textWrap: {
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  pad: {
    height: 240,
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  clearText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
  },
  hint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 13,
    marginTop: spacing.md,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
