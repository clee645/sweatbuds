import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CameraStep } from '@/components/log/CameraStep';
import { PreviewStep } from '@/components/log/PreviewStep';
import { SuccessStep } from '@/components/log/SuccessStep';
import { useAuth } from '@/lib/auth';
import { usePartnership } from '@/lib/partnership';
import { colors } from '@/lib/theme';
import { createWorkout, useWorkouts } from '@/lib/workouts';
import type { Workout } from '@/types/db';

type Step = 'camera' | 'preview' | 'success';

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { workouts, prependWorkout } = useWorkouts();
  const { partnership } = usePartnership();

  const [step, setStep] = useState<Step>('camera');
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [environmentUri, setEnvironmentUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);

  const handleCapturesComplete = useCallback(
    ({ selfieUri: s, environmentUri: e }: { selfieUri: string; environmentUri: string }) => {
      setSelfieUri(s);
      setEnvironmentUri(e);
      setStep('preview');
    },
    [],
  );

  const handleRetake = useCallback(() => {
    setSelfieUri(null);
    setEnvironmentUri(null);
    setCaption('');
    setErrorMessage(null);
    setStep('camera');
  }, []);

  const handleLog = useCallback(async () => {
    if (submitting) return;
    if (!user) {
      setErrorMessage('You need to be signed in.');
      return;
    }
    if (!selfieUri || !environmentUri) {
      setErrorMessage('Missing captures. Tap X and try again.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const workout = await createWorkout({
        userId: user.id,
        partnershipId:
          partnership && partnership.status === 'active' ? partnership.id : null,
        selfieUri,
        environmentUri,
        caption: caption.trim() || null,
      });
      prependWorkout(workout);
      setSavedWorkout(workout);
      setStep('success');
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : 'Could not log workout. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    caption,
    environmentUri,
    partnership,
    prependWorkout,
    selfieUri,
    submitting,
    user,
  ]);

  if (!user) {
    // Defensive — modal should not be reachable without an authed user.
    router.back();
    return null;
  }

  return (
    <View style={styles.root}>
      {step !== 'success' ? (
        <View style={[styles.fill, step === 'preview' && styles.hidden]}>
          <CameraStep
            active={step === 'camera'}
            onCapturesComplete={handleCapturesComplete}
          />
        </View>
      ) : null}

      {step === 'preview' && selfieUri && environmentUri ? (
        <PreviewStep
          selfieUri={selfieUri}
          environmentUri={environmentUri}
          caption={caption}
          submitting={submitting}
          errorMessage={errorMessage}
          onCaptionChange={setCaption}
          onRetake={handleRetake}
          onLog={handleLog}
        />
      ) : null}

      {step === 'success' && savedWorkout && selfieUri && environmentUri ? (
        <SuccessStep
          workout={savedWorkout}
          selfieUri={selfieUri}
          environmentUri={environmentUri}
          user={
            profile ?? {
              id: user.id,
              display_name: 'You',
              avatar_url: null,
              created_at: new Date().toISOString(),
              timezone: null,
              is_pro: false,
            }
          }
          allWorkouts={workouts}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
