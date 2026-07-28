/**
 * All user-facing date/duration formatting. One implementation per concept —
 * previously three incompatible duration formatters existed across the app.
 */
import { IST_OFFSET_MS } from "./ist";

const IST_LOCALE = "en-IN";
const IST_TZ = "Asia/Kolkata";

type Instant = Date | string | number;

const toDate = (v: Instant): Date => (v instanceof Date ? v : new Date(v));

/* ── Durations ─────────────────────────────────────────────────────────────
 * Two distinct needs, deliberately separate:
 *   clock()   — a live, ticking timer.        e.g. "07:42", "1:03:20"
 *   duration() — a compact historical total.  e.g. "45s", "12m", "2h 5m"
 */

/** Stopwatch display. Pads to MM:SS, grows to H:MM:SS past an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Compact human total, for accumulated time. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s === 0) return "0m";
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

/* ── Dates (always rendered in IST) ───────────────────────────────────────── */

export function formatDate(value: Instant): string {
  return toDate(value).toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateWithWeekday(value: Instant): string {
  return toDate(value).toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: Instant): string {
  return toDate(value).toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: Instant): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

/**
 * Month label for a UTC timestamp that represents an IST month boundary.
 * The offset is re-added so the boundary instant lands inside the month.
 */
export function formatMonth(utcTimestamp: number): string {
  return new Date(utcTimestamp + IST_OFFSET_MS).toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TZ,
    month: "long",
    year: "numeric",
  });
}

/** Coarse relative label: "just now", "5m ago", "3h ago", "2d ago". */
export function formatRelative(value: Instant | null | undefined): string | null {
  if (!value) return null;
  const diffMs = Date.now() - toDate(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "3 times" / "1 time" — avoids sprinkling ternaries through JSX. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
