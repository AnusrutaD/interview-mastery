/**
 * Rubric self-assessment for open-ended design exercises.
 *
 * The problem this solves: nobody can grade their own system design honestly in
 * the abstract. "I think that went okay" is not a signal. A concrete checklist
 * of things a strong answer covers — "did you pick a partition key and justify
 * it?" — converts a vague feeling into a number you can track and re-test.
 *
 * Criteria are weighted because not all omissions are equal: forgetting to
 * estimate QPS is a bigger miss than not naming a specific database product.
 */
import type { MasteryLevel } from "./mastery";

export interface RubricCriterion {
  id: string;
  /** The check itself, phrased as something you either did or didn't do. */
  label: string;
  /** Why it matters — shown as a hint so the rubric also teaches. */
  hint?: string;
  /** Defaults to 1. Use 2 for criteria that separate strong from average. */
  weight?: number;
}

export interface RubricSection {
  title: string;
  criteria: readonly RubricCriterion[];
}

export interface RubricResult {
  score: number;
  max: number;
  percent: number;
  /** Criteria left unchecked — literally the study list for next attempt. */
  missedIds: string[];
  band: RubricBand;
}

export type RubricBand = "needs-work" | "developing" | "solid" | "strong";

export const RUBRIC_BANDS: Record<RubricBand, { label: string; minPercent: number }> = {
  "needs-work": { label: "Needs work", minPercent: 0 },
  developing: { label: "Developing", minPercent: 40 },
  solid: { label: "Solid", minPercent: 65 },
  strong: { label: "Strong", minPercent: 85 },
};

const weightOf = (criterion: RubricCriterion) => criterion.weight ?? 1;

export function flattenCriteria(sections: readonly RubricSection[]): RubricCriterion[] {
  return sections.flatMap((section) => [...section.criteria]);
}

export function maxScore(sections: readonly RubricSection[]): number {
  return flattenCriteria(sections).reduce((sum, c) => sum + weightOf(c), 0);
}

export function bandFor(percent: number): RubricBand {
  if (percent >= RUBRIC_BANDS.strong.minPercent) return "strong";
  if (percent >= RUBRIC_BANDS.solid.minPercent) return "solid";
  if (percent >= RUBRIC_BANDS.developing.minPercent) return "developing";
  return "needs-work";
}

export function scoreRubric(
  sections: readonly RubricSection[],
  checkedIds: readonly string[]
): RubricResult {
  const checked = new Set(checkedIds);
  const criteria = flattenCriteria(sections);

  let score = 0;
  const missedIds: string[] = [];

  for (const criterion of criteria) {
    if (checked.has(criterion.id)) score += weightOf(criterion);
    else missedIds.push(criterion.id);
  }

  const max = criteria.reduce((sum, c) => sum + weightOf(c), 0);
  const percent = max === 0 ? 0 : Math.round((score / max) * 100);

  return { score, max, percent, missedIds, band: bandFor(percent) };
}

/**
 * Suggested mastery level from a rubric score.
 *
 * Only ever a *suggestion* — the user makes the final call, because they know
 * whether they genuinely reasoned to an answer or pattern-matched a checklist.
 * Anything below "developing" maps to `unsolved`: the design was attempted and
 * did not hold up, which is exactly what that level is for.
 */
export function suggestMastery(result: RubricResult): MasteryLevel {
  switch (result.band) {
    case "strong":
      return "mastered";
    case "solid":
      return "familiar";
    case "developing":
      return "learning";
    case "needs-work":
      return "unsolved";
  }
}
