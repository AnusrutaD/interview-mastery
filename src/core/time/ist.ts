/**
 * The single source of truth for IST (UTC+05:30) date arithmetic.
 *
 * Strategy: shift a UTC instant by the IST offset, then read its *UTC* fields.
 * Those fields now spell the IST wall-clock time. This is deterministic on both
 * server and client and never depends on the host machine's locale or TZ —
 * which is why we do not use `toLocaleString` for any arithmetic.
 *
 * Nothing else in the codebase may define an IST offset. Import from here.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

/** IST wall-clock parts for a given instant. */
export interface ISTParts {
  year: number;
  /** 0-indexed, matching Date semantics. */
  month: number;
  date: number;
  /** 0 = Sunday. */
  weekday: number;
}

type Instant = Date | string | number;

const toMs = (value: Instant): number =>
  value instanceof Date ? value.getTime() : new Date(value).getTime();

/** Break an instant into IST wall-clock parts. */
export function istParts(value: Instant = Date.now()): ISTParts {
  const d = new Date(toMs(value) + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** UTC timestamp for IST midnight of the day containing `value`. */
export function istDayStart(value: Instant = Date.now()): number {
  const { year, month, date } = istParts(value);
  return Date.UTC(year, month, date) - IST_OFFSET_MS;
}

/** UTC timestamp for IST midnight of the Monday of that IST week. */
export function istWeekStart(value: Instant = Date.now()): number {
  const { year, month, date, weekday } = istParts(value);
  const daysBack = weekday === 0 ? 6 : weekday - 1; // ISO week: Monday first
  return Date.UTC(year, month, date - daysBack) - IST_OFFSET_MS;
}

/** UTC timestamp for IST midnight on the 1st of that IST month. */
export function istMonthStart(value: Instant = Date.now()): number {
  const { year, month } = istParts(value);
  return Date.UTC(year, month, 1) - IST_OFFSET_MS;
}

/** UTC timestamp for IST midnight on the 1st of the following IST month. */
export function istNextMonthStart(value: Instant = Date.now()): number {
  const { year, month } = istParts(value);
  return Date.UTC(month === 11 ? year + 1 : year, (month + 1) % 12, 1) - IST_OFFSET_MS;
}

/** Start of today in IST, as a Date. Convenience for comparisons. */
export function istToday(): Date {
  return new Date(istDayStart());
}

/** Stable key identifying an IST calendar day. Safe for Set/Map membership. */
export function istDayKey(value: Instant = Date.now()): string {
  const { year, month, date } = istParts(value);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/**
 * Whole IST calendar days between two instants (b - a).
 *
 * Calendar-day based, not 24h based: something solved at 23:00 yesterday is
 * exactly 1 day ago at 09:00 today, even though only 10 hours elapsed. Review
 * scheduling depends on this distinction.
 */
export function istDaysBetween(a: Instant, b: Instant = Date.now()): number {
  return Math.round((istDayStart(b) - istDayStart(a)) / DAY_MS);
}

/** True when the instant falls on the current IST calendar day. */
export function isISTToday(value: Instant): boolean {
  return istDayKey(value) === istDayKey();
}
