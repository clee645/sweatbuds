import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function SignInScreen() {
  const { session, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Redirect href="/" />;
  }

  const handlePress = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerWrap}>
        <Text style={styles.wordmark}>Sweatbuds</Text>
      </View>

      <View style={styles.heroWrap}>
        <Text style={styles.title}>Log workouts{'\n'}with your partner.</Text>
        <Text style={styles.subtitle}>
          One tap. Two photos. Both of you stay on track.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handlePress}
          disabled={submitting}
          style={({ pressed }) => [
            styles.googleBtn,
            pressed && styles.pressed,
            submitting && styles.disabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#1F1F1F" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#1F1F1F" />
              <Text style={styles.googleLabel}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.fineprint}>
          By continuing you agree to our terms.
        </Text>
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
  headerWrap: {
    paddingTop: spacing.xl,
    alignItems: 'center',
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
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  googleBtn: {
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  googleLabel: {
    color: '#1F1F1F',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  fineprint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 12,
  },
});
