import * as Sentry from '@sentry/react-native';

import { isNetworkError } from './errors';

// Sentry is the system of record for errors — lib/posthog.ts stays product
// analytics only, so a handled failure is reported in exactly one place.
//
// Deliberately not folded into lib/errors.ts: that module is pure and unit
// tested, and importing a native SDK there would drag the whole React Native
// runtime into the test environment.
//
// Values land as Sentry tags rather than extra context because they're
// low-cardinality identifiers (operation, provider) — tags are indexed, so
// they're filterable and groupable in the Issues view.
export function captureException(
  error: unknown,
  tags?: Record<string, string>,
): void {
  // Offline failures are expected, not bugs. toUserMessage already turns them
  // into OFFLINE_MESSAGE for the user, and reporting them would bury real
  // defects under connectivity noise from people on the subway.
  if (isNetworkError(error)) return;
  Sentry.captureException(toError(error), tags ? { tags } : undefined);
}

// Supabase's PostgrestError (and anything else thrown that isn't an Error) has
// no stack and fails `instanceof Error`, so Sentry files it as "Non-Error
// exception captured" with no usable title. Wrap it so the issue is readable,
// keeping the original on `cause`.
function toError(error: unknown): unknown {
  if (error instanceof Error) return error;
  if (typeof error === 'string' && error) return new Error(error);
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    const { message } = error as { message: string };
    return new Error(message, { cause: error });
  }
  return error;
}

// Ties subsequent events to a user, so Sentry's "users affected" counts are
// real instead of IP-derived guesses (one person on wifi then cellular
// otherwise reads as two; a whole office behind one IP reads as one).
//
// Uses the Supabase user id — the same distinct id PostHog identifies with — so
// a Sentry issue and a PostHog session recording resolve to the same person.
// Deliberately id-only: no email or name, which keeps the payload a meaningless
// UUID while still giving accurate counts.
export function identifyUser(id: string): void {
  Sentry.setUser({ id });
}

// Must run on sign-out. Without it the next person to use this device inherits
// the previous user's identity and their crashes are misattributed.
export function clearUser(): void {
  Sentry.setUser(null);
}
