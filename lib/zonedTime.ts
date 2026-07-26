// Calendar-day math in an explicit IANA timezone.
//
// Everything here works on "ymd" strings ("YYYY-MM-DD") rather than Date
// objects. That's deliberate: a Date carries an instant, and every previous
// bug in this area came from re-deriving a calendar day from an instant using
// whatever zone the *reading device* happened to be in. Two paired partners in
// different zones must agree on which day a workout belongs to, so the zone is
// always passed in explicitly.
//
// Day arithmetic (addDays/diffDays) is done on the calendar, never by adding
// 86_400_000ms, which makes it immune to DST: a "day" is a day even when the
// underlying span is 23 or 25 hours.
//
// No dependency needed — Hermes ships full ICU, so Intl.DateTimeFormat with a
// timeZone option is available on device.

const MS_PER_DAY = 86_400_000;

// Intl.DateTimeFormat construction is comparatively expensive and these are
// called per-workout inside bucketing loops.
const ymdFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function ymdFormatter(tz: string): Intl.DateTimeFormat {
  let f = ymdFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    ymdFormatters.set(tz, f);
  }
  return f;
}

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetFormatters.set(tz, f);
  }
  return f;
}

function partsToRecord(parts: Intl.DateTimeFormatPart[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

// The device's own IANA zone, used as the last-resort fallback.
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// "YYYY-MM-DD" for the calendar day that `instant` falls on, in `tz`.
export function zonedYmd(instant: Date | string, tz: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return '';
  const { year, month, day } = partsToRecord(ymdFormatter(tz).formatToParts(d));
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`;
}

// Milliseconds that `tz` is ahead of UTC at the given instant.
function tzOffsetMs(instant: Date, tz: string): number {
  const p = partsToRecord(offsetFormatter(tz).formatToParts(instant));
  // hour12:false yields 24 for midnight in some ICU versions; normalize.
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  // Trim sub-second noise so the result is a clean offset.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// The UTC instant of 00:00 on `ymd` in `tz`. This is the value to compare
// against a stored timestamptz — it's an absolute point in time, identical on
// both partners' devices.
export function zonedMidnightUtc(ymd: string, tz: string): Date {
  const wallMs = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(wallMs)) return new Date(NaN);
  // Solve utc = wall - offset(utc). Two passes converge: the first guess is at
  // most one offset away, and the second corrects for a DST transition landing
  // between the guess and the answer.
  let utc = wallMs - tzOffsetMs(new Date(wallMs), tz);
  utc = wallMs - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

// Convenience: start of the calendar day containing `instant`, in `tz`.
export function zonedDayStart(instant: Date | string, tz: string): Date {
  return zonedMidnightUtc(zonedYmd(instant, tz), tz);
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

// Pure calendar arithmetic — no timezone needed, and unaffected by DST.
export function addZonedDays(ymd: string, days: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const t = Date.UTC(p.y, p.m - 1, p.d) + days * MS_PER_DAY;
  const d = new Date(t);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(
    d.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Whole calendar days from `from` to `to` (positive when `to` is later).
export function diffZonedDays(to: string, from: string): number {
  const a = parseYmd(to);
  const b = parseYmd(from);
  if (!a || !b) return 0;
  return Math.round(
    (Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / MS_PER_DAY,
  );
}

// JS convention: 0 = Sunday .. 6 = Saturday.
export function zonedDayOfWeek(ymd: string): number {
  const p = parseYmd(ymd);
  if (!p) return 0;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

// Month (1-12) and day-of-month, for formatting week ranges without going
// back through a device-local Date.
export function zonedMonthDay(ymd: string): { month: number; day: number } {
  const p = parseYmd(ymd);
  if (!p) return { month: 1, day: 1 };
  return { month: p.m, day: p.d };
}

// True when `ymd` is a real calendar date.
export function isValidYmd(ymd: string): boolean {
  const p = parseYmd(ymd);
  if (!p) return false;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return (
    d.getUTCFullYear() === p.y && d.getUTCMonth() === p.m - 1 && d.getUTCDate() === p.d
  );
}
