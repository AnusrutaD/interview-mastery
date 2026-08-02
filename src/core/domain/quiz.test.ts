import { describe, expect, it } from "vitest";
import { gradeQuiz, isComplete, isCorrect, QUIZ_PASS_PERCENT, type QuizQuestion } from "./quiz";

const questions: QuizQuestion[] = [
  { id: "q1", question: "Write-through cache?", options: ["A", "B", "C"], answerIndex: 1 },
  { id: "q2", question: "Consistent hashing?", options: ["A", "B"], answerIndex: 0 },
  { id: "q3", question: "CAP?", options: ["A", "B", "C"], answerIndex: 2 },
  { id: "q4", question: "Quorum?", options: ["A", "B"], answerIndex: 1 },
  { id: "q5", question: "Sharding?", options: ["A", "B"], answerIndex: 0 },
];

describe("gradeQuiz", () => {
  it("scores a perfect run", () => {
    const result = gradeQuiz(questions, { q1: 1, q2: 0, q3: 2, q4: 1, q5: 0 });
    expect(result).toMatchObject({ correct: 5, total: 5, percent: 100, passed: true });
    expect(result.wrongIds).toEqual([]);
  });

  it("scores an empty attempt without crashing", () => {
    const result = gradeQuiz(questions, {});
    expect(result).toMatchObject({ correct: 0, percent: 0, passed: false });
    expect(result.wrongIds).toHaveLength(5);
  });

  it("collects wrong answers in question order", () => {
    const result = gradeQuiz(questions, { q1: 0, q2: 0, q3: 0, q4: 1, q5: 0 });
    expect(result.wrongIds).toEqual(["q1", "q3"]);
    expect(result.correct).toBe(3);
  });

  it("treats an unanswered question as wrong, not as skipped", () => {
    const result = gradeQuiz(questions, { q1: 1, q2: 0, q3: 2, q4: 1 });
    expect(result.correct).toBe(4);
    expect(result.wrongIds).toEqual(["q5"]);
  });

  it("applies the 80% pass threshold", () => {
    // 4/5 = 80% — exactly on the line, passes.
    expect(gradeQuiz(questions, { q1: 1, q2: 0, q3: 2, q4: 1, q5: 1 }).passed).toBe(true);
    // 3/5 = 60% — fails.
    expect(gradeQuiz(questions, { q1: 1, q2: 0, q3: 2, q4: 0, q5: 1 }).passed).toBe(false);
  });

  it("keeps the threshold high enough that a bare majority fails", () => {
    expect(QUIZ_PASS_PERCENT).toBeGreaterThan(50);
  });

  it("handles an empty quiz", () => {
    expect(gradeQuiz([], {})).toMatchObject({ correct: 0, total: 0, percent: 0 });
  });
});

describe("isComplete", () => {
  it("is false while any question is unanswered", () => {
    expect(isComplete(questions, { q1: 0, q2: 0 })).toBe(false);
  });

  it("is true once every question has an answer, right or wrong", () => {
    expect(isComplete(questions, { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 })).toBe(true);
  });

  // Option index 0 is falsy — a naive truthiness check would report the first
  // option as "not answered" and permanently disable the submit button.
  it("counts option 0 as an answer", () => {
    expect(isComplete([questions[0]], { q1: 0 })).toBe(true);
  });
});

describe("isCorrect", () => {
  it("compares against the answer index", () => {
    expect(isCorrect(questions[0], { q1: 1 })).toBe(true);
    expect(isCorrect(questions[0], { q1: 2 })).toBe(false);
    expect(isCorrect(questions[0], {})).toBe(false);
  });
});
