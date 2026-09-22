// Bounds an await that has no timeout of its own — a native call or a network
// request that can hang indefinitely. A stalled call then surfaces as a
// rejected promise the caller can act on, instead of leaving a spinner up
// forever.

// Carries "timed out" in the message so the shared network-error copy path
// (lib/errors.ts) reads a timeout as a retryable, offline-style failure. The
// class lets a caller tell a stalled await apart from a real error.
export class TimeoutError extends Error {
  readonly label: string;

  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.label = label;
  }
}

export function isTimeoutError(e: unknown): e is TimeoutError {
  return e instanceof TimeoutError;
}

export function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
