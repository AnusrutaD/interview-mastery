/**
 * Named time windows for the activity page.
 *
 * All boundaries are UTC timestamps derived from IST calendar days via the
 * shared `core/time/ist` module — the activity page previously carried its own
 * copy of that arithmetic.
 */
import {
  DAY_MS,
  WEEK_MS,
  istDayStart,
  istMonthStart,
  istNextMonthStart,
  istWeekStart,
} from "@/core/time/ist";
import { formatDate, formatMonth } from "@/core/time/format";

export interface Period {
  /** Inclusive lower bound (UTC ms). */
  start: number;
  /** Exclusive upper bound (UTC ms). */
  end: number;
  label: string;
}

export type PeriodKind = "today" | "yesterday" | "week" | "month";

export const QUICK_PERIODS: ReadonlyArray<{ kind: PeriodKind; label: string }> = [
  { kind: "today", label: "Today" },
  { kind: "yesterday", label: "Yesterday" },
  { kind: "week", label: "This Week" },
  { kind: "month", label: "This Month" },
];

export function todayPeriod(now: number = Date.now()): Period {
  const start = istDayStart(now);
  return { start, end: start + DAY_MS, label: "Today" };
}

export function yesterdayPeriod(now: number = Date.now()): Period {
  const start = istDayStart(now - DAY_MS);
  return { start, end: start + DAY_MS, label: "Yesterday" };
}

/** Most recent `count` ISO weeks (Monday-start), newest first. */
export function recentWeeks(count = 12, now: number = Date.now()): Period[] {
  const thisMonday = istWeekStart(now);
  return Array.from({ length: count }, (_, index) => {
    const start = thisMonday - index * WEEK_MS;
    const end = start + WEEK_MS;
    const range = `${formatDate(start)} – ${formatDate(end - DAY_MS)}`;
    return { start, end, label: index === 0 ? `This Week (${range})` : range };
  });
}

/** Most recent `count` calendar months, newest first. */
export function recentMonths(count = 12, now: number = Date.now()): Period[] {
  const periods: Period[] = [];
  let cursor = istMonthStart(now);

  for (let index = 0; index < count; index += 1) {
    const start = cursor;
    const end = istNextMonthStart(start + DAY_MS);
    const name = formatMonth(start);
    periods.push({ start, end, label: index === 0 ? `This Month (${name})` : name });
    // Step into the previous month by walking back one day from its start.
    cursor = istMonthStart(start - DAY_MS);
  }

  return periods;
}

/** Strip the parenthetical range, e.g. "This Week (1 Jul – 7 Jul)" → "This Week". */
export function shortLabel(label: string): string {
  const index = label.indexOf(" (");
  return index === -1 ? label : label.slice(0, index);
}
