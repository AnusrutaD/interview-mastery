export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyPresentation {
  textColor: string;
  bgColor: string;
  darkTextColor: string;
  darkBgColor: string;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyPresentation> = {
  Easy: {
    textColor: "text-green-700",
    bgColor: "bg-green-100",
    darkTextColor: "dark:text-green-300",
    darkBgColor: "dark:bg-green-900/40",
  },
  Medium: {
    textColor: "text-amber-700",
    bgColor: "bg-amber-100",
    darkTextColor: "dark:text-amber-300",
    darkBgColor: "dark:bg-amber-900/40",
  },
  Hard: {
    textColor: "text-red-700",
    bgColor: "bg-red-100",
    darkTextColor: "dark:text-red-300",
    darkBgColor: "dark:bg-red-900/40",
  },
};

/** Canonical study order — easiest first. Used to sort topic problem lists. */
export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};

export function compareDifficulty(a: Difficulty, b: Difficulty): number {
  return DIFFICULTY_ORDER[a] - DIFFICULTY_ORDER[b];
}
