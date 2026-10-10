import { describe, expect, it } from 'vitest';

import { bucketWorkoutsBySoloWeek } from './historyWeek';
import type { Workout } from '@/types/db';

const TZ = 'America/Los_Angeles';
// Saturday 2026-10-10, 10:00 local.
const NOW = new Date('2026-10-10T17:00:00Z');

function workout(id: string, loggedDate: string): Workout {
  return {
    id,
    user_id: 'me',
    partnership_id: null,
    selfie_path: `me/${id}/selfie.jpg`,
    environment_path: null,
    caption: null,
    logged_at: `${loggedDate}T18:00:00Z`,
    logged_date: loggedDate,
    logged_tz: TZ,
  } as Workout;
}

describe('bucketWorkoutsBySoloWeek', () => {
  it('always includes the current Monday week, even when empty', () => {
    const buckets = bucketWorkoutsBySoloWeek([], TZ, NOW);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].startYmd).toBe('2026-10-05');
    expect(buckets[0].endYmd).toBe('2026-10-12');
    expect(buckets[0].workouts).toHaveLength(0);
  });

  it('places workouts on the right day of their Monday week', () => {
    const buckets = bucketWorkoutsBySoloWeek(
      [workout('mon', '2026-10-05'), workout('sat', '2026-10-10'), workout('sun', '2026-10-11')],
      TZ,
      NOW,
    );
    expect(buckets).toHaveLength(1);
    const [week] = buckets;
    expect(week.byDay[0].map((w) => w.id)).toEqual(['mon']);
    expect(week.byDay[5].map((w) => w.id)).toEqual(['sat']);
    expect(week.byDay[6].map((w) => w.id)).toEqual(['sun']);
  });

  it('keeps past weeks with workouts, skips empty ones, newest first', () => {
    const buckets = bucketWorkoutsBySoloWeek(
      [workout('a', '2026-09-14'), workout('b', '2026-09-30'), workout('c', '2026-10-06')],
      TZ,
      NOW,
    );
    expect(buckets.map((b) => b.startYmd)).toEqual(['2026-10-05', '2026-09-28', '2026-09-14']);
  });
});
