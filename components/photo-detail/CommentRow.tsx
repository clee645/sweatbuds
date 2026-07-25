import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';
import type { Profile, WorkoutComment } from '@/types/db';

type Props = {
  comment: WorkoutComment;
  profile: Profile | null;
};

export function CommentRow({ comment, profile }: Props) {
  const displayName = profile?.display_name ?? 'Friend';
  const avatarUrl = profile?.avatar_url ?? undefined;
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.row}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.content}>{comment.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardElevated,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  body: { flex: 1, gap: 2 },
  name: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
  },
  content: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
});
