import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const projectToken = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined;
const host = Constants.expoConfig?.extra?.posthogHost as string | undefined;

// Analytics must never take the app down. A missing key degrades to a null
// client — every call site already guards with `?.` — but warn loudly in dev so
// the gap is obvious instead of silently costing events.
if (__DEV__ && (!projectToken || !host)) {
  console.warn(
    '[posthog] EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN and/or EXPO_PUBLIC_POSTHOG_HOST are unset — ' +
      'analytics events will be dropped. See .env.example.',
  );
}

export const posthog =
  projectToken && host
    ? new PostHog(projectToken, {
        host,
        // Off by default in this SDK. The PostHog project has Session Replay
        // enabled and two Replay Vision scanners armed, both of which need the
        // client to actually record.
        enableSessionReplay: true,
      })
    : null;

type ExceptionProperties = Parameters<PostHog['captureException']>[1];

export function captureException(error: unknown, properties?: ExceptionProperties): void {
  if (!posthog) return;
  posthog.captureException(error, properties);
}
