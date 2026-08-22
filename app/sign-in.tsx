import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/GoogleLogo';
import { NoAccountError, useAuth } from '@/lib/auth';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Provider = 'apple' | 'google';

export default function SignInScreen() {
  const { session, signInWithApple, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);

  // Don't redirect while a sign-in is in flight or after we've ejected a
  // just-created account — the OAuth call briefly sets a session before we sign
  // it back out, and redirecting on that transient session would flash Home.
  if (session && submitting === null && !noAccount) {
    return <Redirect href="/" />;
  }

  const goToOnboarding = () => router.replace('/onboarding/welcome');

  const handlePress = async (provider: Provider) => {
    if (submitting) return;
    setError(null);
    setNoAccount(false);
    setSubmitting(provider);
    try {
      await (provider === 'apple'
        ? signInWithApple({ requireExisting: true })
        : signInWithGoogle({ requireExisting: true }));
    } catch (e) {
      if (e instanceof NoAccountError) {
        setNoAccount(true);
      } else {
        setError(toUserMessage(e, 'Sign-in failed. Try again.'));
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerWrap}>
        <Pressable
          onPress={goToOnboarding}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to onboarding"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.wordmark}>Sweatbuds</Text>
      </View>

      <View style={styles.heroWrap}>
        <Image
          source={require('../assets/ghost-mascot.png')}
          style={styles.ghost}
        />
        <Text style={styles.title}>Log workouts{'\n'}with your partner.</Text>
        <Text style={styles.subtitle}>
          One tap. Two photos. Both of you stay on track.
        </Text>
      </View>

      <View style={styles.footer}>
        {Platform.OS === 'ios' ? (
          <Pressable
            onPress={() => handlePress('apple')}
            disabled={submitting !== null}
            style={({ pressed }) => [
              styles.authBtn,
              styles.appleBtn,
              pressed && styles.pressed,
              submitting !== null && styles.disabled,
            ]}
          >
            {submitting === 'apple' ? (
              <ActivityIndicator color="#111111" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#111111" />
                <Text style={[styles.authLabel, styles.appleLabel]}>
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => handlePress('google')}
          disabled={submitting !== null}
          style={({ pressed }) => [
            styles.authBtn,
            styles.googleBtn,
            pressed && styles.pressed,
            submitting !== null && styles.disabled,
          ]}
        >
          {submitting === 'google' ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <GoogleLogo size={20} />
              <Text style={[styles.authLabel, styles.googleLabel]}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.fineprint}>
          By continuing you agree to our{' '}
          <Text
            style={styles.fineprintLink}
            onPress={() => void Linking.openURL('https://sweatbuds.app/terms')}
          >
            Terms
          </Text>
          {' '}and{' '}
          <Text
            style={styles.fineprintLink}
            onPress={() => void Linking.openURL('https://sweatbuds.app/privacy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      {noAccount ? <NoAccountToast onHidden={() => setNoAccount(false)} /> : null}
    </SafeAreaView>
  );
}

const TOAST_VISIBLE_MS = 4200;
const TOAST_SLIDE_MS = 260;
// Enough to park the full-height banner fully below the screen while hidden.
const TOAST_OFFSET = 260;

// Temporary red banner that spans the entire bottom of the screen, slides up,
// holds, then slides back down and unmounts itself via onHidden. One-shot per
// mount — the parent gates mounting on `noAccount`, so a fresh instance animates
// each time.
function NoAccountToast({ onHidden }: { onHidden: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(TOAST_OFFSET);
  const opacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

    const slideIn = { duration: TOAST_SLIDE_MS, easing: Easing.out(Easing.cubic) };
    const slideOut = { duration: TOAST_SLIDE_MS, easing: Easing.in(Easing.cubic) };

    // A single sequence per value: slide/fade in, hold, then slide/fade out.
    // Assigning `.value` twice would just cancel the first animation, so the
    // in + out phases must live in one withSequence().
    translateY.value = withSequence(
      withTiming(0, slideIn),
      withDelay(TOAST_VISIBLE_MS, withTiming(TOAST_OFFSET, slideOut)),
    );
    opacity.value = withSequence(
      withTiming(1, slideIn),
      withDelay(
        TOAST_VISIBLE_MS,
        withTiming(0, slideOut, (finished) => {
          'worklet';
          if (finished) runOnJS(onHidden)();
        }),
      ),
    );
    // Run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toastRoot, { bottom: -insets.bottom }, animatedStyle]}
    >
      <View
        style={[
          styles.toastBanner,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <Text style={styles.toastText}>
          No account found. Please complete onboarding first.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  headerWrap: {
    paddingTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    top: spacing.xl - 4,
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.2,
  },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  ghost: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingBottom: spacing.xxxl + spacing.md,
    gap: spacing.md,
  },
  authBtn: {
    height: 54,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  appleBtn: {
    backgroundColor: '#F4F1EA',
  },
  googleBtn: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  appleLabel: {
    color: '#111111',
  },
  googleLabel: {
    color: colors.text,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  // Full-bleed: cancel the screen's horizontal padding so the banner spans the
  // entire width. `bottom` is overridden inline to reach past the safe area.
  toastRoot: {
    position: 'absolute',
    left: -spacing.lg,
    right: -spacing.lg,
    zIndex: 100,
  },
  toastBanner: {
    width: '100%',
    backgroundColor: colors.danger,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toastText: {
    ...typography.bodyStrong,
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  fineprint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 12,
  },
  fineprintLink: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
});
