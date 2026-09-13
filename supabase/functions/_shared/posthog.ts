import { PostHog } from 'npm:posthog-node';

const projectToken = Deno.env.get('POSTHOG_PROJECT_TOKEN');
const host = Deno.env.get('POSTHOG_HOST');

export const posthog =
  projectToken && host
    ? new PostHog(projectToken, {
        host,
        flushAt: 1,
        flushInterval: 0,
      })
    : null;

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!posthog) return;
  posthog.capture({
    distinctId,
    event,
    properties,
  });
  // capture() only queues — it returns void, so awaiting it is a no-op. The
  // isolate is torn down as soon as the handler returns its Response, so
  // without an awaited flush the event's HTTP request never completes. Swallow
  // failures: a dropped analytics event must never fail the caller's request.
  try {
    await posthog.flush();
  } catch (e) {
    console.error('posthog flush failed:', e);
  }
}
