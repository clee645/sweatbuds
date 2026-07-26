import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Purchases, { type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoPaymentDueRow } from '@/components/onboarding/NoPaymentDueRow';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { PlanCard } from '@/components/onboarding/PlanCard';
import { TrialTimeline } from '@/components/onboarding/TrialTimeline';
import { matchesDemoCode, setDemoUnlocked } from '@/lib/demoMode';
import { toUserMessage } from '@/lib/errors';
import { setPaywallSeen } from '@/lib/onboarding';
import { redeemPromoCode } from '@/lib/promo';
import {
  hasProEntitlement,
  purchasePackage,
  restorePurchases,
} from '@/lib/revenuecat';
import { useSubscription } from '@/lib/subscription';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Plan = 'monthly' | 'yearly';

const PLAN_COPY = {
  monthly: {
    button: 'Commit to Your Goals',
    footer: 'Billed monthly. Cancel anytime.',
    sub: 'No commitment, cancel anytime',
  },
  yearly: {
    button: 'Try for FREE',
    footer: '7 days free, then billed annually. Cancel anytime.',
    sub: 'No payment due now',
  },
} as const;

// Fallback prices shown while RC offerings are loading or unavailable.
const FALLBACK_PRICES = {
  monthly: { price: '$6.99', period: '/mo' },
  yearly: { price: '$4.16', period: '/mo' },
} as const;

export default function PaywallScreen() {
  const router = useRouter();
  const { offering, loading, refresh } = useSubscription();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Promo code entry (also accepts the App Review demo code).
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  // Set when a 'discount' promo rebinds the paywall to a cheaper offering.
  const [promoOffering, setPromoOffering] = useState<PurchasesOffering | null>(null);
  const [promoLabel, setPromoLabel] = useState<string | null>(null);

  const copy = PLAN_COPY[plan];

  // A discount promo swaps in its own offering; otherwise use the current one.
  const activeOffering = promoOffering ?? offering;

  const packages = useMemo(() => {
    return {
      monthly: activeOffering?.monthly ?? null,
      yearly: activeOffering?.annual ?? null,
    } satisfies Record<Plan, PurchasesPackage | null>;
  }, [activeOffering]);

  const display = useMemo(() => {
    const monthly = packages.monthly?.product;
    const annual = packages.yearly?.product;
    return {
      monthly: monthly
        ? { price: monthly.priceString, period: '/mo' }
        : FALLBACK_PRICES.monthly,
      yearly: annual
        ? { price: monthlyEquivalent(annual.price, annual.currencyCode), period: '/mo' }
        : FALLBACK_PRICES.yearly,
    };
  }, [packages]);

  const finishPaywall = async () => {
    await setPaywallSeen();
    router.push('/onboarding/paywall-success');
  };

  const skip = async () => {
    await setPaywallSeen();
    router.replace('/');
  };

  const handlePurchase = async () => {
    if (submitting) return;
    setError(null);
    const pkg = packages[plan];
    if (!pkg) {
      // Offerings unavailable — fall back to RC's prebuilt paywall, which
      // can render against a default RC dashboard configuration even when
      // our own offering lookup misses.
      await presentRcPaywall();
      return;
    }
    setSubmitting(true);
    try {
      const result = await purchasePackage(pkg);
      if (result.kind === 'success') {
        await finishPaywall();
      } else if (result.kind === 'error') {
        setError(result.message);
      }
      // cancelled — silent
    } finally {
      setSubmitting(false);
    }
  };

  const presentRcPaywall = async () => {
    try {
      const result = await RevenueCatUI.presentPaywall();
      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED
      ) {
        await finishPaywall();
      }
    } catch (err) {
      setError(toUserMessage(err, 'Could not open paywall'));
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setError(null);
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.kind === 'success') {
        if (hasProEntitlement(result.customerInfo)) {
          await refresh();
          await finishPaywall();
        } else {
          Alert.alert('No purchases to restore', 'We could not find an active subscription on this Apple ID.');
        }
      } else if (result.kind === 'error') {
        setError(result.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleApplyCode = async () => {
    if (promoBusy) return;
    const code = promoCode.trim();
    if (!code) return;
    setPromoError(null);

    // App Review demo code: a local unlock, no purchase or entitlement. Let the
    // access gate take over by finishing the paywall.
    if (matchesDemoCode(code)) {
      await setDemoUnlocked(true);
      await setPaywallSeen();
      router.replace('/');
      return;
    }

    setPromoBusy(true);
    try {
      const outcome = await redeemPromoCode(code);
      if (outcome.kind === 'error') {
        setPromoError(outcome.message);
        return;
      }
      if (outcome.kind === 'granted') {
        // A lifetime/time-limited entitlement was applied server-side. Re-pull
        // customer info so the gate sees Pro, then continue to success.
        await refresh();
        await finishPaywall();
        return;
      }
      // Discount: rebind the paywall to the cheaper offering and show the pill.
      try {
        const offerings = await Purchases.getOfferings();
        const next = offerings.all[outcome.offeringId] ?? null;
        if (!next) {
          setPromoError("That offer isn't available right now.");
          return;
        }
        setPromoOffering(next);
        setPromoLabel(
          outcome.displayLabel ??
            (outcome.percentOff ? `${outcome.percentOff}% OFF applied` : 'Discount applied'),
        );
        setPromoOpen(false);
        setPromoCode('');
      } catch {
        setPromoError('Could not load that offer. Try again.');
      }
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={skip}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.title}>Unlock Sweatbuds to reach your goals faster</Text>

        <View style={styles.timeline}>
          <TrialTimeline plan={plan} />
        </View>

        {promoLabel ? (
          <View style={styles.promoPill}>
            <Ionicons name="pricetag" size={13} color={colors.accent} />
            <Text style={styles.promoPillText}>{promoLabel}</Text>
          </View>
        ) : null}

        <Text style={styles.covers}>One subscription covers both{'\n'}partners</Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.plans}>
          <PlanCard
            title="Monthly"
            price={display.monthly.price}
            period={display.monthly.period}
            selected={plan === 'monthly'}
            onPress={() => setPlan('monthly')}
          />
          <PlanCard
            title="Yearly"
            price={display.yearly.price}
            period={display.yearly.period}
            badge="7-Day TRIAL"
            selected={plan === 'yearly'}
            onPress={() => setPlan('yearly')}
          />
        </View>
        <NoPaymentDueRow text={copy.sub} />
        <OnboardingButton
          variant="orange"
          label={submitting ? 'Processing…' : copy.button}
          onPress={handlePurchase}
          disabled={submitting || loading}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {promoOpen ? (
          <View style={styles.promoRow}>
            <TextInput
              value={promoCode}
              onChangeText={(t) => {
                setPromoCode(t);
                if (promoError) setPromoError(null);
              }}
              placeholder="Promo code"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleApplyCode}
              editable={!promoBusy}
              style={styles.promoInput}
            />
            <Pressable
              onPress={handleApplyCode}
              disabled={promoBusy || !promoCode.trim()}
              hitSlop={6}
              style={({ pressed }) => [
                styles.promoApply,
                (promoBusy || !promoCode.trim()) && styles.promoApplyDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.promoApplyText}>{promoBusy ? '…' : 'Apply'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setPromoOpen(true)} hitSlop={8}>
            <Text style={styles.promoToggle}>Have a promo code?</Text>
          </Pressable>
        )}
        {promoError ? <Text style={styles.error}>{promoError}</Text> : null}

        <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8}>
          <Text style={styles.restore}>
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </Text>
        </Pressable>
        <Text style={styles.fineprint}>{copy.footer}</Text>
      </View>
    </SafeAreaView>
  );
}

// Convert an annual price into a /month display string in the same currency.
// Floor (rather than round) to 2 decimals so we never overstate the monthly
// cost — e.g. $49.99/yr shows as $4.16/mo, not $4.17.
function monthlyEquivalent(price: number, currency: string): string {
  const perMonth = Math.floor((price / 12) * 100) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(perMonth);
  } catch {
    return `$${perMonth.toFixed(2)}`;
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  scroll: {
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xxl,
  },
  timeline: {
    marginBottom: spacing.sm,
  },
  covers: {
    ...typography.bodyStrong,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -spacing.lg,
    marginBottom: spacing.lg,
  },
  plans: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    fontSize: 12,
  },
  restore: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  promoToggle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  promoInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    fontSize: 15,
  },
  promoApply: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  promoApplyDisabled: {
    opacity: 0.5,
  },
  promoApplyText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.accent,
  },
  promoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.lg,
  },
  promoPillText: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.accent,
  },
  fineprint: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
});
