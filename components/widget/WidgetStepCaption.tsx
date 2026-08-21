import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/lib/theme';

// Shared muted-caption style — also used by the walkthrough's success screens.
export const mutedCaption = {
  ...typography.bodyStrong,
  fontSize: 17,
  textAlign: 'center',
  color: colors.textMuted,
  lineHeight: 22,
} as const;

// Per-step instruction copy for the widget walkthrough. Shared by the Settings
// pager and the post-purchase onboarding screens so the two never drift.
export function WidgetStepCaption({ step }: { step: number }) {
  if (step === 0) {
    return (
      <Text style={styles.captionMuted}>
        Hold down on any app{'\n'}to edit your Home Screen
      </Text>
    );
  }
  if (step === 1) {
    return (
      <View style={styles.captionStack}>
        <View style={styles.captionInlineRow}>
          <Text style={styles.caption}>Tap the </Text>
          <View style={styles.captionEditPill}>
            <Text style={styles.captionEditPillText}>Edit</Text>
          </View>
          <Text style={styles.caption}> button</Text>
        </View>
        <Text style={styles.caption}>in the top left corner</Text>
      </View>
    );
  }
  if (step === 2) {
    return (
      <View style={styles.captionStack}>
        <View style={styles.captionInlineRow}>
          <Text style={styles.caption}>Tap </Text>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={[styles.caption, styles.accentInline]}> Add Widget</Text>
        </View>
        <Text style={styles.caption}>from the menu</Text>
      </View>
    );
  }
  return (
    <View style={styles.captionStack}>
      <Text style={styles.caption}>
        Search for <Text style={styles.accentInline}>Sweatbuds</Text>
      </Text>
      <Text style={styles.caption}>and add the widget</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  captionStack: { alignItems: 'center', gap: 4 },
  captionInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caption: {
    ...typography.bodyStrong,
    fontSize: 17,
    textAlign: 'center',
    color: colors.text,
  },
  captionMuted: mutedCaption,
  captionEditPill: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  captionEditPillText: { ...typography.bodyStrong, fontSize: 14, color: colors.text },
  accentInline: { color: colors.accent },
});
