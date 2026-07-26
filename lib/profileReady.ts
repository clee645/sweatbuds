// Barrier that lets post-sign-in work wait until the display name collected
// during onboarding has actually landed on the user's profile row.
//
// PendingProfileSetup and PendingInvitePairer mount together and run
// independently. Pairing is a single call while the profile write used to sit
// behind an image resize + upload, so pairing almost always won — and the
// inviter's one-shot "X joined your team" toast then snapshotted the
// OAuth-seeded name instead of the name the joiner typed.
//
// Keyed by user id so a sign-out / sign-in within one app session gets a fresh
// barrier rather than inheriting the previous user's resolved one.

type Barrier = { promise: Promise<void>; resolve: () => void };

const barriers = new Map<string, Barrier>();

function barrierFor(userId: string): Barrier {
  const existing = barriers.get(userId);
  if (existing) return existing;

  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  const created: Barrier = { promise, resolve };
  barriers.set(userId, created);
  return created;
}

// Called by PendingProfileSetup once the name is persisted — or once it's known
// there is nothing to persist. Idempotent; extra calls are no-ops.
export function markProfileReady(userId: string): void {
  barrierFor(userId).resolve();
}

// Resolves when the name has landed, or after `timeoutMs`. A failed write or a
// stalled network must never strand pairing, so this always settles.
export function waitForProfileReady(userId: string, timeoutMs = 8000): Promise<void> {
  const { promise } = barrierFor(userId);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
