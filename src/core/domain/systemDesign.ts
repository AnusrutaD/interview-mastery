/**
 * System-design study domain.
 *
 * Two item kinds, because they are learned differently:
 *   - concept  — you read it, then a quiz checks you absorbed it.
 *   - exercise — you attempt an open-ended design, then score yourself
 *                against a rubric.
 */

export const STUDY_ITEM_TYPES = ["concept", "exercise"] as const;
export type StudyItemType = (typeof STUDY_ITEM_TYPES)[number];

/**
 * Recurring system-design patterns. Ordering is curriculum order: foundations
 * first, then the traffic-shaped problems that build on them.
 */
export const SD_PATTERNS = [
  "Fundamentals",
  "Caching",
  "Sharding",
  "Replication",
  "High Read Traffic",
  "High Write Traffic",
  "Realtime Updates",
  "Fanout",
  "Rate Limiting",
  "Handling Failures",
] as const;

export type SDPattern = (typeof SD_PATTERNS)[number];

export const PATTERN_ICONS: Readonly<Record<string, string>> = {
  Fundamentals: "🧱",
  Caching: "⚡",
  Sharding: "🪓",
  Replication: "🔁",
  "High Read Traffic": "📖",
  "High Write Traffic": "✍️",
  "Realtime Updates": "📡",
  Fanout: "📣",
  "Rate Limiting": "🚦",
  "Handling Failures": "🛟",
};

export function patternIcon(pattern: string): string {
  return PATTERN_ICONS[pattern] ?? "🔧";
}

/** Depth tiers, mirroring difficulty for coding problems. */
export const SD_LEVELS = ["Fundamental", "Intermediate", "Advanced"] as const;
export type SDLevel = (typeof SD_LEVELS)[number];

export const SD_LEVEL_CONFIG: Record<
  SDLevel,
  { textColor: string; bgColor: string; darkTextColor: string; darkBgColor: string }
> = {
  Fundamental: {
    textColor: "text-green-700",
    bgColor: "bg-green-100",
    darkTextColor: "dark:text-green-300",
    darkBgColor: "dark:bg-green-900/40",
  },
  Intermediate: {
    textColor: "text-amber-700",
    bgColor: "bg-amber-100",
    darkTextColor: "dark:text-amber-300",
    darkBgColor: "dark:bg-amber-900/40",
  },
  Advanced: {
    textColor: "text-red-700",
    bgColor: "bg-red-100",
    darkTextColor: "dark:text-red-300",
    darkBgColor: "dark:bg-red-900/40",
  },
};

export function isStudyItemType(value: unknown): value is StudyItemType {
  return typeof value === "string" && (STUDY_ITEM_TYPES as readonly string[]).includes(value);
}
