import { describe, expect, it } from 'vitest';

import { dueInactivityNudge, isWithinSendWindow } from './inactivity';

const DAY_MS = 86_400_000;
const lastActivityAt = '2026-09-01T12:00:00.000Z';
const daysAfter = (days: number) => new Date(Date.parse(lastActivityAt) + days * DAY_MS);

describe('dueInactivityNudge', () => {
  it('sends nothing before 4 days', () => {
    expect(
      dueInactivityNudge({
        lastActivityAt,
        now: daysAfter(3.9),
        nudgedStage: null,
        nudgedAnchorAt: null,
      }),
    ).toBeNull();
  });

  it('walks the ladder once per stage', () => {
    expect(
      dueInactivityNudge({ lastActivityAt, now: daysAfter(4), nudgedStage: null, nudgedAnchorAt: null })
        ?.stage,
    ).toBe(1);
    expect(
      dueInactivityNudge({ lastActivityAt, now: daysAfter(5), nudgedStage: 1, nudgedAnchorAt: lastActivityAt }),
    ).toBeNull();
    expect(
      dueInactivityNudge({ lastActivityAt, now: daysAfter(7), nudgedStage: 1, nudgedAnchorAt: lastActivityAt })
        ?.stage,
    ).toBe(2);
    expect(
      dueInactivityNudge({ lastActivityAt, now: daysAfter(14), nudgedStage: 2, nudgedAnchorAt: lastActivityAt })
        ?.stage,
    ).toBe(3);
    expect(
      dueInactivityNudge({ lastActivityAt, now: daysAfter(40), nudgedStage: 3, nudgedAnchorAt: lastActivityAt }),
    ).toBeNull();
  });

  it('skips straight to the highest stage reached', () => {
    expect(
      dueInactivityNudge({ lastActivityAt, now: daysAfter(20), nudgedStage: null, nudgedAnchorAt: null })
        ?.stage,
    ).toBe(3);
  });

  it('starts over after a new post', () => {
    const newer = '2026-09-10T08:00:00.000Z';
    expect(
      dueInactivityNudge({
        lastActivityAt: newer,
        now: new Date(Date.parse(newer) + 4 * DAY_MS),
        nudgedStage: 3,
        nudgedAnchorAt: lastActivityAt,
      })?.stage,
    ).toBe(1);
  });

  it('matches anchors written in a different ISO format', () => {
    expect(
      dueInactivityNudge({
        lastActivityAt,
        now: daysAfter(5),
        nudgedStage: 1,
        nudgedAnchorAt: '2026-09-01T12:00:00+00:00',
      }),
    ).toBeNull();
  });
});

describe('isWithinSendWindow', () => {
  it('uses the couple’s local hour', () => {
    // 17:00 UTC = 10:00 in Los Angeles (PDT).
    const now = new Date('2026-09-21T17:00:00Z');
    expect(isWithinSendWindow(now, 'America/Los_Angeles')).toBe(true);
    // Same instant is 02:00 next day in Tokyo.
    expect(isWithinSendWindow(now, 'Asia/Tokyo')).toBe(false);
  });

  it('falls back to UTC for a missing or bogus zone', () => {
    const now = new Date('2026-09-21T12:00:00Z');
    expect(isWithinSendWindow(now, null)).toBe(true);
    expect(isWithinSendWindow(now, 'Not/AZone')).toBe(true);
    expect(isWithinSendWindow(new Date('2026-09-21T03:00:00Z'), 'Not/AZone')).toBe(false);
  });
});
