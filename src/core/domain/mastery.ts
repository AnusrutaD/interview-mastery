/**
 * Mastery is the user's self-assessed confidence on a problem.
 *
 * Ordered weakest to strongest. `unsolved` sits between `unseen` and
 * `learning`: the problem was attempted and lost, which is a different signal
 * from never having opened it — and a much more useful one, since those are
 * exactly the problems worth returning to.
 */
export const MASTERY_LEVELS = ["unseen", "unsolved", "learning", "familiar", "mastered"] as const;

export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export interface MasteryPresentation {
  label: string;
  textColor: string;
  bgColor: string;
  /** Dark-mode variants kept alongside so callers never hand-roll them. */
  darkTextColor: string;
  darkBgColor: string;
}

export const MASTERY_CONFIG: Record<MasteryLevel, MasteryPresentation> = {
  unseen: {
    label: "Unseen",
    textColor: "text-gray-500",
    bgColor: "bg-gray-100",
    darkTextColor: "dark:text-gray-400",
    darkBgColor: "dark:bg-gray-800",
  },
  unsolved: {
    label: "Unsolved",
    textColor: "text-rose-700",
    bgColor: "bg-rose-100",
    darkTextColor: "dark:text-rose-300",
    darkBgColor: "dark:bg-rose-900/40",
  },
  learning: {
    label: "Learning",
    textColor: "text-blue-700",
    bgColor: "bg-blue-100",
    darkTextColor: "dark:text-blue-300",
    darkBgColor: "dark:bg-blue-900/40",
  },
  familiar: {
    label: "Familiar",
    textColor: "text-amber-700",
    bgColor: "bg-amber-100",
    darkTextColor: "dark:text-amber-300",
    darkBgColor: "dark:bg-amber-900/40",
  },
  mastered: {
    label: "Mastered",
    textColor: "text-green-700",
    bgColor: "bg-green-100",
    darkTextColor: "dark:text-green-300",
    darkBgColor: "dark:bg-green-900/40",
  },
};

export function isMasteryLevel(value: unknown): value is MasteryLevel {
  return typeof value === "string" && (MASTERY_LEVELS as readonly string[]).includes(value);
}

/** Narrow an untrusted value, falling back to "unseen". */
export function toMasteryLevel(value: unknown): MasteryLevel {
  return isMasteryLevel(value) ? value : "unseen";
}

/** A problem counts as attempted once it leaves "unseen". */
export function isAttempted(level: MasteryLevel): boolean {
  return level !== "unseen";
}

/**
 * Whether the user actually got the problem out.
 *
 * Distinct from `isAttempted`: an unsolved problem is real practice and counts
 * towards coverage, but it must not count towards the daily *solved* goal —
 * "🎉 Daily goal complete!" after failing three problems would be absurd.
 */
export function isSolved(level: MasteryLevel): boolean {
  return level !== "unseen" && level !== "unsolved";
}
