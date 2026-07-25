import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoPaymentDueRow } from '@/components/onboarding/NoPaymentDueRow';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { colors, spacing, typography } from '@/lib/theme';

// Paywall flow, screen 1 — the free-trial intro. First screen after sign-up;
// intentionally has no back affordance.
export default function PaywallIntroScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['rgba(255,90,95,0.18)', 'rgba(255,90,95,0)']}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <Text style={styles.title}>
          We want you to try Sweatbuds for{' '}
          <Text style={styles.titleAccent}>free</Text>
        </Text>

        <View style={styles.imageWrap}>
          <Image
            source={require('../../assets/onboarding/try-free-phone.png')}
            style={styles.image}
            contentFit="contain"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <NoPaymentDueRow text="No Payment Due Now" />
        <OnboardingButton
          variant="orange"
          label="Try it $0.00"
          onPress={() => router.push('/onboarding/paywall-reminder')}
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
  glow: {
    position: 'absolute',
    top: 0,
    left: -spacing.lg,
    right: -spacing.lg,
    height: 320,
  },
  content: {
    flex: 1,
    paddingTop: 88,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleAccent: {
    color: colors.orange,
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '78%',
    height: '100%',
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
});
