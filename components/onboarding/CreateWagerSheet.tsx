import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Keyboard,
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

const QUANTITIES = Array.from({ length: 10 }, (_, i) => i + 1);

type Props = {
  visible: boolean;
  initialQuantity?: number;
  initialText?: string;
  onClose: () => void;
  onDone: (quantity: number, text: string) => void;
};

// Slide-up sheet for entering a custom wager — a quantity selector plus a free
// text field ("massage", "dessert", …).
export function CreateWagerSheet({
  visible,
  initialQuantity = 1,
  initialText = '',
  onClose,
  onDone,
}: Props) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [text, setText] = useState(initialText);
  const [qtyOpen, setQtyOpen] = useState(false);

  // Sync fields each time the sheet is opened.
  useEffect(() => {
    if (visible) {
      setQuantity(initialQuantity);
      setText(initialText);
      setQtyOpen(false);
    }
  }, [visible, initialQuantity, initialText]);

  const canSubmit = text.trim().length > 0;

  const handleDone = () => {
    if (!canSubmit) return;
    onDone(quantity, text.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.title}>Create your own wager</Text>
            <Text style={styles.subtitle}>Each missed workout = 1 of these.</Text>

            <View style={styles.inputRow}>
              <Pressable
                style={styles.qtyBox}
                onPress={() => {
                  Keyboard.dismiss();
                  setQtyOpen((v) => !v);
                }}
              >
                <Text style={styles.qtyText}>{quantity}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
              <View style={styles.divider} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="e.g. massage, dessert, movie pick"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                selectionColor={colors.accent}
                onFocus={() => setQtyOpen(false)}
                returnKeyType="done"
                onSubmitEditing={handleDone}
              />

              {qtyOpen ? (
                <View style={styles.qtyDropdown}>
                  <ScrollView style={styles.qtyScroll} keyboardShouldPersistTaps="handled">
                    {QUANTITIES.map((n) => (
                      <Pressable
                        key={n}
                        style={styles.qtyOption}
                        onPress={() => {
                          setQuantity(n);
                          setQtyOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.qtyOptionText,
                            n === quantity && styles.qtyOptionSelected,
                          ]}
                        >
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={handleDone}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.doneBtn,
                !canSubmit && styles.doneBtnDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
            >
              <Text style={[styles.doneText, !canSubmit && styles.doneTextDisabled]}>
                Done
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 64,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.cardElevated,
  },
  qtyBox: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  qtyText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: spacing.md,
  },
  qtyDropdown: {
    position: 'absolute',
    // Opens upward so the options stay on screen above the keyboard.
    bottom: 68,
    left: 0,
    width: 88,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 10,
  },
  qtyScroll: {
    maxHeight: 200,
  },
  qtyOption: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  qtyOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  qtyOptionSelected: {
    color: colors.accent,
  },
  doneBtn: {
    marginTop: spacing.xl,
    height: 58,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  doneBtnDisabled: {
    backgroundColor: colors.cardElevated,
  },
  pressed: { opacity: 0.85 },
  doneText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneTextDisabled: {
    color: colors.textDim,
  },
});
