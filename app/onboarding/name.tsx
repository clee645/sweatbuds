import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { setPendingDisplayName } from '@/lib/onboarding';
import { colors, spacing, typography } from '@/lib/theme';

// Onboarding setup screen — collect the user's first name / pet name.
export default function NameScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const [name, setName] = useState('');

  const trimmed = name.trim();

  const handleContinue = async () => {
    if (!trimmed) return;
    await setPendingDisplayName(trimmed);
    router.push(flow === 'join' ? '/onboarding/profile-pic?flow=join' : '/onboarding/profile-pic');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.64} />

      <View style={styles.content}>
        <Text style={styles.title}>What&apos;s your first name?</Text>
        <Text style={styles.subtitle}>(pet name preferred)</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="First Name"
          placeholderTextColor={colors.textDim}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={24}
          selectionColor={colors.accent}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          style={styles.input}
        />

        <View style={styles.buttonWrap}>
          <OnboardingButton
            label="Continue"
            variant="accent"
            disabled={!trimmed}
            onPress={handleContinue}
          />
        </View>
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
    alignItems: 'center',
  },
  title: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  input: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xxxl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    color: colors.text,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonWrap: {
    width: 220,
    marginTop: spacing.xxxl + spacing.md,
  },
});
