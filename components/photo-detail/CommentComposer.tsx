import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  isOwnWorkout: boolean;
  onSubmit: (content: string) => Promise<void>;
};

export function CommentComposer({ isOwnWorkout, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !submitting;
  const placeholder = isOwnWorkout ? 'Leave a comment' : 'Hype your partner up';

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } catch {
      // Caller surfaces error if needed; keep the draft so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.bar}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={280}
          editable={!submitting}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        hitSlop={8}
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={colors.bg} />
        ) : (
          <Ionicons name="send" size={18} color={colors.bg} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
