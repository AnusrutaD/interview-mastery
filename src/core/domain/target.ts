/**
 * Study targets over a period.
 *
 * Two units, because one does not fit both kinds of list:
 *
 *   - `count`   — "3 problems a day". Right when items are comparable.
 *   - `minutes` — "30 minutes a day". Right for video, where a playlist mixes
 *                 5-minute clips with 90-minute lectures and a count target is
 *                 meaningless.
 *
 * Periods are IST calendar boundaries, reusing the same helpers as streaks and
 * the activity page so "today" never means two different things.
 */
import { istDayStart, istMonthStart, istNextMonthStart, istWeekStart, DAY_MS, WEEK_MS } from "../time/ist";

export const TARGET_PERIODS = ["daily", "weekly", "monthly"] as const;
export type TargetPeriod = (typeof TARGET_PERIODS)[number];

export const TARGET_UNITS = ["count", "minutes"] as const;
export type TargetUnit = (typeof TARGET_UNITS)[number];

export const PERIOD_LABELS: Record<TargetPeriod, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

export interface Target {
  period: TargetPeriod;
  unit: TargetUnit;
  /** Items to finish, or minutes to spend, within the period. */
  value: number;
}

export interface PeriodWindow {
  /** Inclusive lower bound, UTC ms. */
  start: number;
  /** Exclusive upper bound, UTC ms. */
  end: number;
}

export function periodWindow(period: TargetPeriod, now: number = Date.now()): PeriodWindow {
  switch (period) {
    case "daily": {
      const start = istDayStart(now);
      return { start, end: start + DAY_MS };
    }
    case "weekly": {
      const start = istWeekStart(now);
      return { start, end: start + WEEK_MS };
    }
    case "monthly": {
      const start = istMonthStart(now);
      // Month lengths vary, so the end comes from the calendar rather than
      // from adding a fixed number of days.
      return { start, end: istNextMonthStart(now) };
    }
  }
}

/** One completed item's contribution to a target. */
export interface Contribution {
  at: string | Date | number;
  /** Seconds spent or watched. Only used by `minutes` targets. */
  seconds: number;
}

export interface TargetProgress {
  target: Target;
  /** Items finished, or minutes accumulated, inside the window. */
  done: number;
  /** 0–100, capped. */
  percent: number;
  met: boolean;
  /** How much is still needed. Zero once met. */
  remaining: number;
  window: PeriodWindow;
}

/**
 * Measure progress toward a target.
 *
 * Contributions outside the window are ignored rather than partially credited —
 * a target is about what you did in this period, not a rolling average.
 */
export function measureTarget(
  target: Target,
  contributions: readonly Contribution[],
  now: number = Date.now()
): TargetProgress {
  const window = periodWindow(target.period, now);

  let done = 0;
  for (const contribution of contributions) {
    const at = new Date(contribution.at).getTime();
    if (Number.isNaN(at) || at < window.start || at >= window.end) continue;
    done += target.unit === "minutes" ? contribution.seconds / 60 : 1;
  }

  const rounded = target.unit === "minutes" ? Math.floor(done) : done;
  const value = Math.max(1, target.value);

  return {
    target,
    done: rounded,
    percent: Math.min(100, Math.round((rounded / value) * 100)),
    met: rounded >= value,
    remaining: Math.max(0, value - rounded),
    window,
  };
}

/** "2 / 5 today" or "18 / 30 min this week". */
export function describeTarget(progress: TargetProgress): string {
  const unit = progress.target.unit === "minutes" ? " min" : "";
  return `${progress.done} / ${progress.target.value}${unit} ${PERIOD_LABELS[progress.target.period]}`;
}

export function isTargetPeriod(value: unknown): value is TargetPeriod {
  return typeof value === "string" && (TARGET_PERIODS as readonly string[]).includes(value);
}

export function isTargetUnit(value: unknown): value is TargetUnit {
  return typeof value === "string" && (TARGET_UNITS as readonly string[]).includes(value);
}

/**
 * Build a target from stored columns, or null when the list has none.
 *
 * A null target means the user deliberately opted out of pacing this list. It
 * must never render as "met" — that distinction is the reason this returns null
 * rather than a zero-valued target.
 */
export function toTarget(input: {
  period?: string | null;
  unit?: string | null;
  value?: number | null;
}): Target | null {
  if (!input.value || input.value <= 0) return null;
  return {
    period: isTargetPeriod(input.period) ? input.period : "daily",
    unit: isTargetUnit(input.unit) ? input.unit : "count",
    value: input.value,
  };
}
