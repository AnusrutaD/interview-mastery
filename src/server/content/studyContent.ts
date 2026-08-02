import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import type { QuizQuestion } from "@/core/domain/quiz";
import type { RubricSection } from "@/core/domain/rubric";
import type { SDLevel, StudyItemType } from "@/core/domain/systemDesign";
import { parseDocument } from "./frontmatter";

const CONTENT_ROOT = join(process.cwd(), "content", "system-design");

export interface StudyItem {
  slug: string;
  type: StudyItemType;
  title: string;
  pattern: string;
  level: SDLevel;
  summary: string;
  /** Estimated minutes to read (concepts) or to attempt (exercises). */
  minutes: number;
  /** Curriculum position; lower sorts first. */
  order: number;
  /** Markdown body — the reading material, or the exercise prompt. */
  body: string;
  quiz: QuizQuestion[];
  rubric: RubricSection[];
  /** Reference solution, revealed only after an attempt is recorded. */
  solution: string | null;
}

/* ── Frontmatter coercion ─────────────────────────────────────────────────── */

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

function toQuiz(raw: unknown, slug: string): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index) => {
    if (typeof entry !== "object" || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const options = Array.isArray(row.options) ? row.options.map((o) => String(o)) : [];
    const answerIndex = num(row.answer, -1);
    // A malformed question is dropped rather than rendered as an unanswerable
    // one — silently wrong content is worse than missing content.
    if (options.length < 2 || answerIndex < 0 || answerIndex >= options.length) return [];
    return [
      {
        id: str(row.id, `${slug}-q${index + 1}`),
        question: str(row.q),
        options,
        answerIndex,
        explanation: str(row.explain) || undefined,
      },
    ];
  });
}

function toRubric(raw: unknown, slug: string): RubricSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, sectionIndex) => {
    if (typeof entry !== "object" || entry === null) return [];
    const section = entry as Record<string, unknown>;
    const criteria = Array.isArray(section.criteria) ? section.criteria : [];
    return [
      {
        title: str(section.title, `Section ${sectionIndex + 1}`),
        criteria: criteria.flatMap((c, i) => {
          if (typeof c !== "object" || c === null) return [];
          const row = c as Record<string, unknown>;
          const label = str(row.label);
          if (!label) return [];
          return [
            {
              id: str(row.id, `${slug}-r${sectionIndex + 1}-${i + 1}`),
              label,
              hint: str(row.hint) || undefined,
              weight: num(row.weight, 1),
            },
          ];
        }),
      },
    ];
  });
}

/**
 * Body sections are split on a `## Reference Solution` heading so the solution
 * can be withheld until the user has attempted the exercise. Keeping it in the
 * same file keeps authoring simple.
 */
const SOLUTION_HEADING = /^##\s+Reference Solution\s*$/im;

function splitSolution(body: string): { body: string; solution: string | null } {
  const match = body.match(SOLUTION_HEADING);
  if (!match || match.index === undefined) return { body, solution: null };
  return {
    body: body.slice(0, match.index).trim(),
    solution: body.slice(match.index + match[0].length).trim(),
  };
}

function loadDirectory(type: StudyItemType): StudyItem[] {
  const dir = join(CONTENT_ROOT, type === "concept" ? "concepts" : "exercises");
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const { data, body } = parseDocument(readFileSync(join(dir, file), "utf8"));
      const split = splitSolution(body);

      return {
        slug,
        type,
        title: str(data.title, slug),
        pattern: str(data.pattern, "Fundamentals"),
        level: (str(data.level, "Fundamental") as SDLevel) ?? "Fundamental",
        summary: str(data.summary),
        minutes: num(data.minutes, type === "concept" ? 8 : 45),
        order: num(data.order, 999),
        body: split.body,
        quiz: toQuiz(data.quiz, slug),
        rubric: toRubric(data.rubric, slug),
        solution: split.solution,
      } satisfies StudyItem;
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * Content is static, so read the filesystem once per request lifecycle.
 * `cache` dedupes across the component tree within a single render.
 */
export const getAllStudyItems = cache((): StudyItem[] => [
  ...loadDirectory("concept"),
  ...loadDirectory("exercise"),
]);

export const getStudyItem = cache((slug: string): StudyItem | null => {
  return getAllStudyItems().find((item) => item.slug === slug) ?? null;
});

/** Items grouped by pattern, in curriculum order. */
export const getStudyItemsByPattern = cache((): Map<string, StudyItem[]> => {
  const map = new Map<string, StudyItem[]>();
  for (const item of getAllStudyItems()) {
    const bucket = map.get(item.pattern);
    if (bucket) bucket.push(item);
    else map.set(item.pattern, [item]);
  }
  return map;
});

/**
 * Everything the client needs, minus the reference solution.
 * Withholding it server-side means it cannot be read out of the page payload
 * before the user has actually attempted the exercise.
 */
export type StudyItemSummary = Omit<StudyItem, "body" | "solution" | "quiz" | "rubric"> & {
  quizCount: number;
  rubricCount: number;
};

export function toSummary(item: StudyItem): StudyItemSummary {
  const { body: _body, solution: _solution, quiz, rubric, ...rest } = item;
  return {
    ...rest,
    quizCount: quiz.length,
    rubricCount: rubric.reduce((n, section) => n + section.criteria.length, 0),
  };
}
