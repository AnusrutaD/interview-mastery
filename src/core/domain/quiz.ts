/**
 * Multiple-choice quiz scoring.
 *
 * Quizzes exist to catch the "I read it and it made sense" illusion — passive
 * comprehension feels identical to understanding until you're asked to choose.
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: readonly string[];
  /** Index into `options`. */
  answerIndex: number;
  /** Shown after answering, whether right or wrong. */
  explanation?: string;
}

/** Answers keyed by question id. Unanswered questions are simply absent. */
export type QuizAnswers = Record<string, number>;

export interface QuizResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  /** Question ids answered incorrectly — the review list. */
  wrongIds: string[];
}

/**
 * A quiz is passed at 80%.
 *
 * Deliberately high: these are 3–5 question checks on a single concept, so
 * scraping a bare majority means the concept is not solid.
 */
export const QUIZ_PASS_PERCENT = 80;

export function gradeQuiz(
  questions: readonly QuizQuestion[],
  answers: QuizAnswers
): QuizResult {
  const wrongIds: string[] = [];
  let correct = 0;

  for (const question of questions) {
    if (answers[question.id] === question.answerIndex) correct += 1;
    else wrongIds.push(question.id);
  }

  const total = questions.length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  return { correct, total, percent, passed: percent >= QUIZ_PASS_PERCENT, wrongIds };
}

/** Every question answered — used to enable the submit button. */
export function isComplete(questions: readonly QuizQuestion[], answers: QuizAnswers): boolean {
  return questions.every((q) => answers[q.id] !== undefined);
}

export function isCorrect(question: QuizQuestion, answers: QuizAnswers): boolean {
  return answers[question.id] === question.answerIndex;
}
