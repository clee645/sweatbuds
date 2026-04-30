import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/lib/theme';
import { PostComposition, type PostPrimary } from './PostComposition';

type Props = {
  selfieUri: string;
  environmentUri: string;
  caption: string;
  submitting: boolean;
  errorMessage: string | null;
  onCaptionChange: (next: string) => void;
  onRetake: () => void;
  onLog: () => void;
};

export function PreviewStep({
  selfieUri,
  environmentUri,
  caption,
  submitting,
  errorMessage,
  onCaptionChange,
  onRetake,
  onLog,
}: Props) {
  const router = useRouter();
  const [editingCaption, setEditingCaption] = useState(false);
  const [primary, setPrimary] = useState<PostPrimary>('selfie');

  const screenW = Dimensions.get('window').width;
  const cardWidth = screenW - spacing.lg * 2;
  const naturalHeight = (cardWidth * 4) / 3;
  const COMPACT_HEIGHT = 240;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(editingCaption ? 1 : 0, { duration: 220 });
  }, [editingCaption, progress]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    width: cardWidth,
    height: naturalHeight + (COMPACT_HEIGHT - naturalHeight) * progress.value,
    aspectRatio: undefined,
  }));

  const handleSwap = () => {
    setPrimary((p) => (p === 'selfie' ? 'environment' : 'selfie'));
  };

  const captionPlaceholder = 'Add a caption';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.wordmark}>Sweatbuds</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.contentWrap}>
          <View style={styles.compositionWrap}>
            <PostComposition
              selfieUri={selfieUri}
              environmentUri={environmentUri}
              primary={primary}
              onSwap={handleSwap}
              onRemove={submitting ? undefined : onRetake}
              style={animatedCardStyle}
              captionSlot={
                editingCaption ? (
                  <View style={styles.captionPillEditing}>
                    <TextInput
                      autoFocus
                      value={caption}
                      onChangeText={onCaptionChange}
                      onBlur={() => setEditingCaption(false)}
                      onSubmitEditing={() => setEditingCaption(false)}
                      placeholder={captionPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      maxLength={140}
                      returnKeyType="done"
                      style={styles.captionInput}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => !submitting && setEditingCaption(true)}
                    style={styles.captionPill}
                    hitSlop={6}
                  >
                    <Text
                      style={[
                        styles.captionText,
                        !caption && styles.captionPlaceholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {caption || captionPlaceholder}
                    </Text>
                  </Pressable>
                )
              }
            />
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            onPress={onLog}
            disabled={submitting}
            style={({ pressed }) => [
              styles.logBtn,
              pressed && styles.logBtnPressed,
              submitting && styles.disabled,
            ]}
            hitSlop={8}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <View style={styles.logBtnRow}>
                <Text style={styles.logBtnLabel}>Log</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.text} />
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  wordmark: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  compositionWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  captionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    minWidth: 120,
    alignItems: 'center',
  },
  captionPillEditing: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 260,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  captionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  captionPlaceholderText: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  captionInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
    textAlign: 'center',
  },
  logBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  logBtnPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.6 },
  logBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logBtnLabel: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  pressed: { opacity: 0.6 },
});
