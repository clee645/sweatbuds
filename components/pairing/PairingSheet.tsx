import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';

import { PairingPanel } from './PairingPanel';

type Props = {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onPaired: (partnerName: string | null) => Promise<void>;
  // Focus the code field on open (when launched from "Enter a code to pair").
  autoFocusCode?: boolean;
};

// Slide-up sheet wrapping the shared PairingPanel. Used from LockedHome so an
// unsubscribed user can pair with a subscribed partner (one sub covers both).
export function PairingSheet({ visible, userId, onClose, onPaired, autoFocusCode }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.title}>Pair with your partner</Text>
            <Text style={styles.subtitle}>
              Enter their code, or share yours so they can pair with you.
            </Text>

            <View style={styles.panelWrap}>
              <PairingPanel userId={userId} onPaired={onPaired} autoFocus={autoFocusCode} />
            </View>
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
    marginTop: spacing.xs,
  },
  // PairingPanel's body is flex:1; give it a fixed height inside the sheet so
  // the Modal's bottom-anchored content lays out without filling the screen.
  panelWrap: {
    height: 360,
    marginTop: spacing.sm,
  },
});
