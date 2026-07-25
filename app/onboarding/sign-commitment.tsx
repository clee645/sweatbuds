import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { SignaturePad, SignaturePadHandle } from '@/components/onboarding/SignaturePad';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding setup screen — sign a commitment, then on to the celebration.
export default function SignCommitmentScreen() {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [signed, setSigned] = useState(false);

  const handleFinish = () => {
    if (!signed) return;
    router.push('/onboarding/celebration');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.79} />

      <View style={styles.content}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Sign your commitment</Text>
          <Text style={styles.subtitle}>
            Promise to show up for your partner and yourself.
          </Text>
        </View>

        <View style={styles.middle}>
          <SignaturePad
            ref={padRef}
            style={styles.pad}
            onSignedChange={setSigned}
          />
          <Pressable onPress={() => padRef.current?.clear()} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear Signature</Text>
          </Pressable>
          <Text style={styles.hint}>Draw on the open space above</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton label="Finish   →" disabled={!signed} onPress={handleFinish} />
        <Text style={styles.caption}>Start your Sweatbuds journey with intention</Text>
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
  },
  textWrap: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 26,
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
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  pad: {
    height: 300,
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
    gap: spacing.md,
  },
  caption: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 13,
  },
});
