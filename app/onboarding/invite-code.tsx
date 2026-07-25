import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { formatCode, isCompleteCode, normalizeCode } from '@/lib/invite';
import { setPendingInviteCode } from '@/lib/onboarding';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Onboarding setup screen — entered from stay-strong's "My partner sent me a
// code". Pairing needs auth, so the code is stashed and PendingInvitePairer
// redeems it after sign-in.
export default function InviteCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const complete = isCompleteCode(code);

  const handleChange = (raw: string) => {
    setCode(formatCode(normalizeCode(raw)));
  };

  const handleConnect = async () => {
    if (!complete) return;
    // Stash the code; PendingInvitePairer redeems it after sign-in. Collect the
    // invitee's own name/photo first (flow=join), then create their account.
    await setPendingInviteCode(normalizeCode(code));
    router.push('/onboarding/name?flow=join');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.5} />

      <View style={styles.content}>
        <Text style={styles.title}>Enter your invite code</Text>
        <Text style={styles.subtitle}>This connects you with your partner.</Text>

        <View style={styles.inputCard}>
          <TextInput
            value={code}
            onChangeText={handleChange}
            placeholder="WU-785"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            maxLength={7}
            selectionColor={colors.accent}
            style={styles.input}
          />
        </View>

        <OnboardingButton
          label="Connect with partner"
          variant="accent"
          disabled={!complete}
          onPress={handleConnect}
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
    paddingTop: spacing.xxxl,
    gap: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 17,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  inputCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  input: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    padding: 0,
  },
});
