import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { GoogleLogo } from '@/components/GoogleLogo';
import { radii, spacing } from '@/lib/theme';

// One button for every Apple / Google auth entry point. App Review rejects
// (Guideline 4) any screen where Sign in with Apple isn't an equivalent option
// to the other providers — same size, font and design — so both providers
// render through this component and differ only in logo and label. White is one
// of the three backgrounds Apple's HIG allows for its button.
export function AuthButton({
  provider,
  label,
  loading,
  disabled,
  onPress,
}: {
  provider: 'apple' | 'google';
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && styles.pressed,
        disabled && !loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={INK} />
      ) : (
        <>
          {provider === 'apple' ? (
            <Ionicons name="logo-apple" size={ICON_SIZE} color={INK} />
          ) : (
            <GoogleLogo size={ICON_SIZE} />
          )}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const INK = '#1F1F1F';
const ICON_SIZE = 20;

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  label: {
    color: INK,
    fontSize: 17,
    fontWeight: '600',
  },
});
