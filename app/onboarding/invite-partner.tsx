import { useRouter } from 'expo-router';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { formatCode } from '@/lib/invite';
import { getOrCreatePendingInviteCode } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding screen — invite the partner via the native share sheet.
export default function InvitePartnerScreen() {
  const router = useRouter();

  const handleInvite = async () => {
    const code = await getOrCreatePendingInviteCode();
    try {
      await Share.share({
        message: `Join me on Sweatbuds! Use my invite code: ${formatCode(code)}`,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.86} />

      <View style={styles.content}>
        <Text style={styles.title}>Sweatbuds only works{'\n'}with your partner</Text>
        <Text style={styles.subtitle}>Invite them now</Text>
      </View>

      <View style={styles.footer}>
        <OnboardingButton label="Invite your partner" onPress={handleInvite} />
        <Pressable
          onPress={() => router.push('/onboarding/one-small-favor')}
          hitSlop={8}
          style={styles.continueRow}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
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
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  continueRow: {
    alignItems: 'center',
  },
  continueText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
