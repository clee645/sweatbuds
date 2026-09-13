import * as Sentry from '@sentry/react-native';

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
  Sentry.captureException(error, tags ? { tags } : undefined);
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
