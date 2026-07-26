export const OFFLINE_MESSAGE =
  "You're offline. Check your connection and try again.";

// React Native's fetch throws a bare TypeError('Network request failed') with
// no status or code, and supabase-js passes it straight through. Postgrest
// wraps its own transport failures similarly. Match on the shapes we actually
// see rather than trying to be exhaustive.
const NETWORK_PATTERNS = [
  'network request failed',
  'failed to fetch',
  'network error',
  'timeout',
  'timed out',
  'econnreset',
  'enotfound',
  'unable to resolve host',
  'the internet connection appears to be offline',
];

export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const message =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : typeof e === 'object' && 'message' in e && typeof e.message === 'string'
          ? e.message
          : '';
  const lower = message.toLowerCase();
  return NETWORK_PATTERNS.some((p) => lower.includes(p));
}

// Single place that turns a thrown value into copy worth showing a user.
// Replaces the `e instanceof Error ? e.message : 'Please try again.'` ternary
// that was duplicated across ~20 Alert.alert call sites — that version leaked
// raw strings like "Network request failed" straight into the UI.
export function toUserMessage(e: unknown, fallback = 'Please try again.'): string {
  if (isNetworkError(e)) return OFFLINE_MESSAGE;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return fallback;
}
