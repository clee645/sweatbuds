import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';
import type { WagerRule } from '@/lib/wagers';

type Props = {
  visible: boolean;
  initialQuantity?: number;
  initialText?: string;
  onClose: () => void;
  onCreate: (wager: WagerRule) => void;
};

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function CreateWagerModal({
  visible,
  initialQuantity = 1,
  initialText = '',
  onClose,
  onCreate,
}: Props) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) {
      setQuantity(initialQuantity);
      setText(initialText);
    }
  }, [visible, initialQuantity, initialText]);

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onCreate({ quantity, text: trimmed, emoji: '' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.bottomWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <View style={styles.card}>
          <View style={styles.handle} />

          <Text style={styles.title}>Create your own wager</Text>
          <Text style={styles.subtitle}>Each missed workout = 1 of these.</Text>

          <View style={styles.inputRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.qtyRow}
            >
              {QUANTITY_OPTIONS.map((n) => {
                const selected = n === quantity;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setQuantity(n)}
                    style={[styles.qtyChip, selected && styles.qtyChipSelected]}
                  >
                    <Text style={[styles.qtyText, selected && styles.qtyTextSelected]}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="e.g. massage, dessert, mov…"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            autoCapitalize="none"
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.doneBtn,
              !canSubmit && styles.doneBtnDisabled,
              pressed && canSubmit && styles.doneBtnPressed,
            ]}
          >
            <Text style={[styles.doneText, !canSubmit && styles.doneTextDisabled]}>
              Done
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  bottomWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.cardElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDim,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputRow: {
    marginBottom: spacing.md,
  },
  qtyRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  qtyChip: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  qtyChipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  qtyText: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  qtyTextSelected: {
    color: colors.accent,
  },
  input: {
    ...typography.bodyStrong,
    fontSize: 17,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  doneBtn: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  doneBtnPressed: { opacity: 0.85 },
  doneBtnDisabled: { opacity: 0.5 },
  doneText: {
    ...typography.bodyStrong,
    fontSize: 17,
  },
  doneTextDisabled: {
    color: colors.textMuted,
  },
});
