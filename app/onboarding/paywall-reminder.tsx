import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoPaymentDueRow } from '@/components/onboarding/NoPaymentDueRow';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { colors, spacing, typography } from '@/lib/theme';

// Paywall flow, screen 2 — reassures the user a reminder fires before billing.
export default function PaywallReminderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          We&apos;ll send you a reminder before your trial ends
        </Text>

        <View style={styles.bellWrap}>
          <View style={styles.bellCircle}>
            <Ionicons name="notifications" size={92} color="#8E8E93" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <NoPaymentDueRow text="No Payment Due Now" />
        <OnboardingButton
          variant="orange"
          label="Continue for FREE"
          onPress={() => router.push('/onboarding/paywall')}
        />
      </View>
    </SafeAreaView>
  );
}

const BELL = 220;
const BADGE = 64;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  pressed: { opacity: 0.5 },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.display,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  bellWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellCircle: {
    width: BELL,
    height: BELL,
    borderRadius: BELL / 2,
    backgroundColor: '#E6E6E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: BELL * 0.06,
    right: BELL * 0.06,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bg,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
});
