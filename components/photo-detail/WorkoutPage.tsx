import { useEffect, useRef } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';

import { CommentRow } from '@/components/photo-detail/CommentRow';
import { WorkoutCard, type PhotoPrimary } from '@/components/home/WorkoutCard';
import { workoutImageSource } from '@/lib/storage';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { Profile, Workout, WorkoutComment } from '@/types/db';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
  workout: Workout;
  uriMap: Record<string, string>;
  comments: WorkoutComment[];
  profileForUserId: (uid: string) => Profile | null;
  cardWidth: number;
  cardHeight: number;
  compactCaption: boolean;
  primary?: PhotoPrimary;
  onSwap?: () => void;
};

export function WorkoutPage({
  workout,
  uriMap,
  comments,
  profileForUserId,
  cardWidth,
  cardHeight,
  compactCaption,
  primary,
  onSwap,
}: Props) {
  const commentsRef = useRef<FlatList<WorkoutComment>>(null);
  const lastCountRef = useRef(comments.length);

  // Auto-scroll the comments list to the newest entry whenever a comment is
  // added so the user always sees their own post (and the partner's) land.
  useEffect(() => {
    if (comments.length > lastCountRef.current) {
      requestAnimationFrame(() => {
        commentsRef.current?.scrollToEnd({ animated: true });
      });
    }
    lastCountRef.current = comments.length;
  }, [comments.length]);

  return (
    <View style={styles.page}>
      <View style={[styles.cardFrame, { width: cardWidth, height: cardHeight }]}>
        <WorkoutCard
          selfie={workoutImageSource(workout.selfie_path, uriMap)}
          environment={
            workout.environment_path
              ? workoutImageSource(workout.environment_path, uriMap)
              : null
          }
          caption={null}
          envSize={compactCaption ? 'compact' : 'large'}
          primary={primary}
          onSwap={onSwap}
        />
      </View>
      {workout.caption && !compactCaption ? (
        <View style={styles.captionBubble}>
          <Text style={styles.caption} numberOfLines={3}>
            {workout.caption}
          </Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <FlatList
        ref={commentsRef}
        style={styles.commentsList}
        data={comments}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.commentsContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CommentRow comment={item} profile={profileForUserId(item.user_id)} />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No comments yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingTop: spacing.md,
    alignItems: 'stretch',
  },
  cardFrame: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  captionBubble: {
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.cardElevated,
    marginBottom: spacing.md,
  },
  caption: {
    ...typography.body,
    fontSize: 15,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
    marginHorizontal: spacing.lg,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
