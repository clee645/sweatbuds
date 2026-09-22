import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OFFLINE_MESSAGE, isNetworkError, toUserMessage } from './errors';
import { TimeoutError, isTimeoutError, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves with the value when the promise settles in time', async () => {
    const p = withTimeout(Promise.resolve('ok'), 1000, 'Step');
    await expect(p).resolves.toBe('ok');
  });

  it('rejects with a TimeoutError once the deadline passes', async () => {
    // A promise that never settles — only the timer resolves the race.
    const p = withTimeout(new Promise<never>(() => {}), 1000, 'Upload');
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('passes a real rejection through unchanged', async () => {
    const boom = new Error('storage rejected');
    await expect(withTimeout(Promise.reject(boom), 1000, 'Upload')).rejects.toBe(boom);
  });

  it('does not fire the timeout after the promise already settled', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1000, 'Step')).resolves.toBe('done');
    // Advancing past the deadline must not surface a late rejection.
    await vi.advanceTimersByTimeAsync(5000);
  });
});

describe('TimeoutError', () => {
  it('reads as a retryable, offline-style failure through the shared copy path', () => {
    const err = new TimeoutError('Image upload', 30_000);
    expect(isTimeoutError(err)).toBe(true);
    // The "timed out" wording routes it to the offline copy, so a stalled step
    // tells the user to retry rather than leaking a raw message.
    expect(isNetworkError(err)).toBe(true);
    expect(toUserMessage(err)).toBe(OFFLINE_MESSAGE);
  });

  it('does not treat an ordinary error as a timeout', () => {
    expect(isTimeoutError(new Error('nope'))).toBe(false);
  });
});
