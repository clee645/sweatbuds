import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function RequestFeatureScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const inputRef = useRef<TextInput>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmed = description.trim();
  const disabled = trimmed.length === 0 || submitting;

  const handleSend = async () => {
    if (disabled || !user) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from('feature_requests')
        .insert({ user_id: user.id, description: trimmed });
      if (error) throw error;
      Alert.alert('Thanks!', 'We got your idea.');
      router.back();
    } catch (e) {
      setErrorMessage(toUserMessage(e, 'Could not send. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Request a feature</Text>
          <Text style={styles.subtitle}>Tell us what you'd love to see in Sweatbuds.</Text>

          <TextInput
            ref={inputRef}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your idea..."
            placeholderTextColor={colors.textDim}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={1000}
            style={styles.input}
          />

          <Pressable
            onPress={handleSend}
            disabled={disabled}
            style={({ pressed }) => [
              styles.sendBtn,
              disabled && styles.sendBtnDisabled,
              pressed && !disabled && styles.sendBtnPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.sendBtnText}>Send</Text>
            )}
          </Pressable>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  handleWrap: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 95,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.display, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    minHeight: 220,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnPressed: { opacity: 0.85 },
  sendBtnText: { ...typography.bodyStrong, fontSize: 17 },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
