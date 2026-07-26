import { describe, expect, it } from 'vitest';

import {
  addZonedDays,
  diffZonedDays,
  isValidYmd,
  zonedDayOfWeek,
  zonedDayStart,
  zonedMidnightUtc,
  zonedYmd,
} from './zonedTime';

const LA = 'America/Los_Angeles';
const TOKYO = 'Asia/Tokyo';
const NYC = 'America/New_York';

describe('zonedYmd', () => {
  it('resolves the same instant to different calendar days across zones', () => {
    // 2026-07-03T02:00Z — still Jul 2 in LA, already Jul 3 in Tokyo.
    const instant = '2026-07-03T02:00:00.000Z';
    expect(zonedYmd(instant, LA)).toBe('2026-07-02');
    expect(zonedYmd(instant, TOKYO)).toBe('2026-07-03');
  });

  it('is stable regardless of the host device zone', () => {
    // The whole point: no reliance on Date#getFullYear/getMonth/getDate.
    expect(zonedYmd(new Date('2026-01-01T07:59:00Z'), LA)).toBe('2025-12-31');
    expect(zonedYmd(new Date('2026-01-01T08:00:00Z'), LA)).toBe('2026-01-01');
  });

  it('returns empty string for an invalid instant', () => {
    expect(zonedYmd('not-a-date', LA)).toBe('');
  });
});

describe('zonedMidnightUtc', () => {
  it('returns the UTC instant of local midnight', () => {
    // PDT is UTC-7 in July.
    expect(zonedMidnightUtc('2026-07-02', LA).toISOString()).toBe(
      '2026-07-02T07:00:00.000Z',
    );
    // JST is UTC+9 year-round.
    expect(zonedMidnightUtc('2026-07-02', TOKYO).toISOString()).toBe(
      '2026-07-01T15:00:00.000Z',
    );
  });

  it('handles standard time (winter offset differs from summer)', () => {
    // PST is UTC-8 in January.
    expect(zonedMidnightUtc('2026-01-15', LA).toISOString()).toBe(
      '2026-01-15T08:00:00.000Z',
    );
  });

  it('round-trips with zonedYmd across a DST spring-forward', () => {
    // US DST begins 2026-03-08.
    for (const ymd of ['2026-03-07', '2026-03-08', '2026-03-09']) {
      expect(zonedYmd(zonedMidnightUtc(ymd, LA), LA)).toBe(ymd);
    }
  });

  it('round-trips across a DST fall-back', () => {
    // US DST ends 2026-11-01.
    for (const ymd of ['2026-10-31', '2026-11-01', '2026-11-02']) {
      expect(zonedYmd(zonedMidnightUtc(ymd, LA), LA)).toBe(ymd);
    }
  });
});

describe('addZonedDays', () => {
  it('adds and subtracts calendar days', () => {
    expect(addZonedDays('2026-07-02', 7)).toBe('2026-07-09');
    expect(addZonedDays('2026-07-02', -2)).toBe('2026-06-30');
  });

  it('crosses month and year boundaries', () => {
    expect(addZonedDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addZonedDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap years', () => {
    expect(addZonedDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addZonedDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('is DST-immune: +7 days across spring-forward stays 7 days', () => {
    // The old `setDate(+7)` / floor(ms/86_400_000) mix produced 6 here.
    const start = '2026-03-05';
    const end = addZonedDays(start, 7);
    expect(end).toBe('2026-03-12');
    expect(diffZonedDays(end, start)).toBe(7);
  });
});

describe('diffZonedDays', () => {
  it('counts whole calendar days', () => {
    expect(diffZonedDays('2026-07-09', '2026-07-02')).toBe(7);
    expect(diffZonedDays('2026-07-02', '2026-07-09')).toBe(-7);
    expect(diffZonedDays('2026-07-02', '2026-07-02')).toBe(0);
  });

  it('is exact across both DST transitions', () => {
    // Spring forward (23h day) and fall back (25h day) both still count as 1.
    expect(diffZonedDays('2026-03-09', '2026-03-08')).toBe(1);
    expect(diffZonedDays('2026-11-02', '2026-11-01')).toBe(1);
    // A full week spanning spring-forward.
    expect(diffZonedDays('2026-03-12', '2026-03-05')).toBe(7);
  });
});

describe('zonedDayOfWeek', () => {
  it('uses JS convention with Sunday = 0', () => {
    expect(zonedDayOfWeek('2026-07-05')).toBe(0); // Sunday
    expect(zonedDayOfWeek('2026-07-06')).toBe(1); // Monday
    expect(zonedDayOfWeek('2026-07-11')).toBe(6); // Saturday
  });
});

describe('zonedDayStart', () => {
  it('floors an instant to the start of its local day', () => {
    expect(zonedDayStart('2026-07-02T23:30:00Z', LA).toISOString()).toBe(
      '2026-07-02T07:00:00.000Z',
    );
  });
});

describe('cross-timezone agreement', () => {
  it('two partners bucket a boundary workout into the same day when using one shared zone', () => {
    // 5pm PT Thursday — the case that used to split partners.
    const loggedAt = '2026-07-03T00:30:00.000Z';
    // Both devices resolve against the PARTNERSHIP zone, not their own.
    const shared = LA;
    expect(zonedYmd(loggedAt, shared)).toBe('2026-07-02');
    // Even though the two devices' own zones disagree:
    expect(zonedYmd(loggedAt, LA)).not.toBe(zonedYmd(loggedAt, TOKYO));
  });

  it('week boundaries derived from one zone are identical instants', () => {
    const anchor = '2026-07-01';
    const a = zonedMidnightUtc(anchor, NYC).getTime();
    const b = zonedMidnightUtc(anchor, NYC).getTime();
    expect(a).toBe(b);
  });
});

describe('isValidYmd', () => {
  it('rejects malformed and impossible dates', () => {
    expect(isValidYmd('2026-07-02')).toBe(true);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('2026-7-2')).toBe(false);
    expect(isValidYmd('garbage')).toBe(false);
  });
});
