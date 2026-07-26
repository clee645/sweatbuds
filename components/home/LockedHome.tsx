import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { toUserMessage } from '@/lib/errors';
import { sharePartnerInvite } from '@/lib/invite';
import { hasProEntitlement, restorePurchases } from '@/lib/revenuecat';
import { useSubscription } from '@/lib/subscription';
import { colors, radii, spacing, typography } from '@/lib/theme';

// The "Start Your Journey" screen shown in place of the real home when the user
// has no active subscription (their own or an active partner's). Lets them
// subscribe, invite/pair with a partner, or restore a prior purchase.
export function LockedHome() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { refresh: refreshSubscription } = useSubscription();

  const [restoring, setRestoring] = useState(false);

  // Invite Partner → native share sheet, identical to the Partner tab's
  // "Share code with partner" action.
  const openInvite = async () => {
    const userId = user?.id;
    if (!userId) return;
    try {
      await sharePartnerInvite(userId);
    } catch (e) {
      const message = toUserMessage(e);
      Alert.alert('Could not share invite', message);
    }
  };

  // Enter a code → hand off to the Partner screen, which owns the pairing flow.
  const openEnterCode = () => {
    router.push('/partner');
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.kind === 'success') {
        if (hasProEntitlement(result.customerInfo)) {
          await refreshSubscription();
          // Gate flips to unlocked on the next render.
        } else {
          Alert.alert(
            'No purchases to restore',
            'We could not find an active subscription on this Apple ID.',
          );
        }
      } else if (result.kind === 'error') {
        Alert.alert('Could not restore', result.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[
          'rgba(255, 90, 95, 0.22)',
          'rgba(255, 90, 95, 0.08)',
          'rgba(255, 90, 95, 0)',
        ]}
        locations={[0, 0.45, 1]}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="barbell" size={32} color={colors.accent} />
        </View>
        <Text style={styles.title}>Start Your Journey</Text>
        <Text style={styles.subtitle}>
          Subscribe to unlock Sweatbuds, or invite{'\n'}your partner to subscribe.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/onboarding/paywall-intro')}
            style={({ pressed }) => [styles.subscribeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.subscribeBtnText}>Subscribe</Text>
          </Pressable>

          <Pressable
            onPress={openInvite}
            style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.text} />
            <Text style={styles.inviteBtnText}>Invite Partner</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable onPress={openEnterCode} hitSlop={8} style={styles.enterCodeWrap}>
            <Text style={styles.enterCodeText}>Enter an invite code to pair</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8} style={styles.restoreWrap}>
          {restoring ? (
            <ActivityIndicator color={colors.textMuted} />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable hitSlop={6} onPress={() => void Linking.openURL('https://sweatbuds.app/terms')}>
            <Text style={styles.legalText}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.legalDot}>•</Text>
          <Pressable hitSlop={6} onPress={() => void Linking.openURL('https://sweatbuds.app/privacy')}>
            <Text style={styles.legalText}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: -spacing.lg,
    right: -spacing.lg,
    height: SCREEN_HEIGHT * 0.55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actions: {
    width: '86%',
    alignSelf: 'center',
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  subscribeBtn: {
    height: 58,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteBtn: {
    height: 58,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteBtnText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.text,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.body,
    color: colors.textMuted,
  },
  enterCodeWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  enterCodeText: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.accent,
  },
  restoreWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 24,
  },
  restoreText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  legalText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textDim,
  },
  legalDot: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textDim,
  },
});
