// Pure scheduling logic for the notify-inactivity Edge Function. No Deno or
// Supabase imports so vitest can exercise it directly (inactivity.test.ts).

const DAY_MS = 86_400_000;

export type InactivityNudge = {
  stage: number;
  days: number;
  title: string;
  body: string;
};

// Ordered by stage. Only the highest stage reached is ever sent, so a couple
// that's already 8 days quiet when the job first sees them gets stage 2 alone
// rather than stages 1 and 2 back to back.
export const INACTIVITY_NUDGES: readonly InactivityNudge[] = [
  {
    stage: 1,
    days: 4,
    title: 'You’re due for a check-in 👀',
    body: 'Get active to hit this week’s goal!',
  },
  {
    stage: 2,
    days: 7,
    title: 'Health is wealth 💪',
    body: 'Get up, move, and record it!',
  },
  {
    stage: 3,
    days: 14,
    title: 'Are you two still alive? 😅',
    body: 'Move together and start fresh!',
  },
];

export const MIN_INACTIVE_DAYS = INACTIVITY_NUDGES[0].days;

// Local-time window pushes may go out in: [start, end). The job runs hourly,
// so a stage reached overnight is delivered at the start of the next window.
export const SEND_WINDOW_START_HOUR = 10;
export const SEND_WINDOW_END_HOUR = 20;

// Which nudge (if any) is due. `nudgedAnchorAt` is the last-activity instant
// the previously sent stage was measured against; once either partner posts,
// last activity moves past it and the ladder starts over from stage 1.
export function dueInactivityNudge(input: {
  lastActivityAt: string;
  now: Date;
  nudgedStage: number | null;
  nudgedAnchorAt: string | null;
}): InactivityNudge | null {
  const lastActivity = Date.parse(input.lastActivityAt);
  if (Number.isNaN(lastActivity)) return null;
  const idleMs = input.now.getTime() - lastActivity;

  let reached: InactivityNudge | null = null;
  for (const nudge of INACTIVITY_NUDGES) {
    if (idleMs >= nudge.days * DAY_MS) reached = nudge;
  }
  if (!reached) return null;

  const sameStretch =
    input.nudgedAnchorAt !== null && Date.parse(input.nudgedAnchorAt) === lastActivity;
  const alreadySent = sameStretch ? (input.nudgedStage ?? 0) : 0;
  return reached.stage > alreadySent ? reached : null;
}

export function isWithinSendWindow(now: Date, timeZone: string | null): boolean {
  const hour = localHour(now, timeZone ?? 'UTC') ?? localHour(now, 'UTC')!;
  return hour >= SEND_WINDOW_START_HOUR && hour < SEND_WINDOW_END_HOUR;
}

function localHour(now: Date, timeZone: string): number | null {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now);
    return Number(formatted);
  } catch {
    // Unrecognized IANA zone string.
    return null;
  }
}
