import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/AuthButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { useAuth } from '@/lib/auth';
import { toUserMessage } from '@/lib/errors';
import { setOnboardingSeen } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

type Provider = 'apple' | 'google';

// Final onboarding screen — sign up to save progress. Once a session exists the
// AuthGate renders the app.
export default function SaveProgressScreen() {
  const { session, signInWithApple, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Redirect href="/" />;
  }

  const run = async (provider: Provider) => {
    if (submitting) return;
    setError(null);
    setSubmitting(provider);
    try {
      await (provider === 'apple'
        ? signInWithApple({ markCompleted: true })
        : signInWithGoogle({ markCompleted: true }));
      await setOnboardingSeen();
    } catch (e) {
      setError(toUserMessage(e, 'Sign-up failed. Try again.'));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['rgba(239,68,68,0.18)', 'rgba(239,68,68,0)']}
        style={styles.glow}
        pointerEvents="none"
      />

      <OnboardingHeader progress={1} />

      <View style={styles.content}>
        <Text style={styles.title}>Save your progress</Text>

        <View style={styles.buttons}>
          {Platform.OS === 'ios' ? (
            <AuthButton
              provider="apple"
              label="Sign up with Apple"
              loading={submitting === 'apple'}
              disabled={submitting !== null}
              onPress={() => run('apple')}
            />
          ) : null}
          <AuthButton
            provider="google"
            label="Sign up with Google"
            loading={submitting === 'google'}
            disabled={submitting !== null}
            onPress={() => run('google')}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.caption}>Your data is private and secure.</Text>
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
  // Soft reddish glow bleeding down from the top edge.
  glow: {
    position: 'absolute',
    top: 0,
    left: -spacing.lg,
    right: -spacing.lg,
    height: 280,
  },
  content: {
    flex: 1,
    paddingTop: 88,
    gap: 72,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttons: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
  },
  caption: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 13,
  },
});
