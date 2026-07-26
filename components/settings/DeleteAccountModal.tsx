import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { toUserMessage } from '@/lib/errors';
import { clearOnboardingSeen, clearPaywallSeen } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function DeleteAccountModal({ visible, onClose }: Props) {
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Missing Supabase URL');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('You are not signed in.');

      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      // Forget onboarding/paywall so re-signing up with the same identity starts
      // fresh (a normal sign-out keeps these, by design).
      await clearOnboardingSeen();
      await clearPaywallSeen();
      await signOut();
    } catch (e) {
      const message = toUserMessage(e);
      Alert.alert('Could not delete account', message);
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={deleting ? undefined : onClose} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.title}>Delete account?</Text>
          <Text style={styles.body}>
            This will permanently delete your account and all associated data. This cannot be
            undone.
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={onClose}
              disabled={deleting}
              style={({ pressed }) => [
                styles.btn,
                styles.cancelBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={deleting}
              style={({ pressed }) => [
                styles.btn,
                styles.deleteBtn,
                (pressed || deleting) && styles.btnPressed,
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.deleteText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.85 },
  cancelBtn: {
    backgroundColor: colors.cardElevated,
  },
  cancelText: { ...typography.bodyStrong, color: colors.text },
  deleteBtn: {
    backgroundColor: colors.danger,
  },
  deleteText: { ...typography.bodyStrong, color: colors.text },
});
