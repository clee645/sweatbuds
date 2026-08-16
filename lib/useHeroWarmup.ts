import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';

import { getSignedUrls, workoutImageSource } from './storage';
import { useWorkouts } from './workouts';

// How long the branded splash may linger waiting for hero photos. A single
// deadline for the WHOLE wait — workouts fetch, signed-URL round trip and
// downloads together — so a slow network can never add more than this to
// startup. Under the ~1s threshold where a pause starts reading as waiting.
const WARMUP_BUDGET_MS = 800;

// Photos warmed before the splash lifts. The carousel stacks three cards and
// only the first is fully visible, so a handful of the newest workouts covers
// what the user actually sees on arrival.
const WARM_WORKOUT_COUNT = 4;

// Warms the home carousel's images into expo-image's cache while the branded
// splash is still up, so home arrives painted rather than buffering.
//
// Returns `ready`, which latches true permanently on first release — logging a
// workout later must never drag the splash back over a running app.
//
// This is a first-launch concern only. Once an image is on disk under its
// stable cache key (see `workoutImageSource`), the disk check below short-
// circuits and this resolves immediately.
export function useHeroWarmup(): boolean {
  const { workouts, loading } = useWorkouts();
  const [ready, setReady] = useState(false);
  const startedRef = useRef(false);
  // Budget starts at mount, not when the workouts land — the fetch is part of
  // what we're capping, not a free prelude to it.
  const deadlineRef = useRef(Date.now() + WARMUP_BUDGET_MS);

  useEffect(() => {
    if (ready) return;

    const remaining = deadlineRef.current - Date.now();
    if (remaining <= 0) {
      setReady(true);
      return;
    }

    // Whatever else happens, the splash lifts at the deadline.
    const timer = setTimeout(() => setReady(true), remaining);

    // Still waiting on the workouts query — the timer above bounds it.
    if (loading) {
      return () => clearTimeout(timer);
    }

    // Nothing to warm (signed out, no workouts yet): release immediately.
    if (workouts.length === 0) {
      clearTimeout(timer);
      setReady(true);
      return;
    }

    // Guard against a second pass if `workouts` re-identifies mid-warm.
    if (startedRef.current) {
      return () => clearTimeout(timer);
    }
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const paths = workouts
          .slice(0, WARM_WORKOUT_COUNT)
          .flatMap((w) =>
            [w.selfie_path, w.environment_path].filter((p): p is string => Boolean(p)),
          );

        // Skip anything already on disk under its cache key — the common case
        // after the first launch, and it keeps this off the network entirely.
        const cacheHits = await Promise.all(
          paths.map((p) => Image.getCachePathAsync(p).catch(() => null)),
        );
        const cold = paths.filter((_, i) => !cacheHits[i]);
        if (cancelled) return;
        if (cold.length === 0) {
          setReady(true);
          return;
        }

        const uriMap = await getSignedUrls(cold);
        if (cancelled) return;

        await Promise.all(
          cold.map((p) =>
            Image.loadAsync(workoutImageSource(p, uriMap)).catch(() => null),
          ),
        );
        if (cancelled) return;
        setReady(true);
      } catch {
        // Offline, expired session, storage hiccup — none of it is worth
        // holding the app hostage over. Home handles missing images already.
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, loading, workouts]);

  return ready;
}
