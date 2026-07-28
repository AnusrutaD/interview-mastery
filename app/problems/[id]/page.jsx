"use client";
import { useEffect, useState, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PROBLEMS, MASTERY_CONFIG, MASTERY_ORDER, DIFF_CONFIG } from "@/data/problems";
import { reviewLabel, isDue, REVIEW_INTERVALS } from "@/lib/spaced-repetition";
import MarkdownNote from "@/components/MarkdownNote";

// Category hints shown to guide problem-solving approach
const CATEGORY_HINTS = {
  "Arrays & Hashing": [
    "Consider using a hash map for O(1) average-case lookups.",
    "Think about what you're mapping: value → index, value → count, etc.",
    "Sorting first can simplify the logic but costs O(n log n).",
  ],
  "Two Pointers": [
    "Start with one pointer at each end and move them toward the middle.",
    "Think about when to advance the left vs right pointer.",
    "Useful when the array is sorted or you need pairs summing to a target.",
  ],
  "Sliding Window": [
    "Use two pointers (left, right) to define the window boundary.",
    "Expand the right pointer; shrink from the left when the window is invalid.",
    "Track a running count/sum to avoid recomputing from scratch.",
  ],
  "Stack": [
    "Push elements and pop when you find a matching pair or trigger condition.",
    "Monotonic stacks are useful for 'next greater/smaller element' problems.",
    "Think about what information you need to 'remember' from earlier.",
  ],
  "Binary Search": [
    "The input doesn't have to be a sorted array — think about what you're searching.",
    "Define your search space clearly: what does left/right represent?",
    "Use `mid = left + (right - left) // 2` to avoid overflow.",
  ],
  "Linked List": [
    "Draw it out — visualizing pointer manipulation prevents bugs.",
    "A dummy head node simplifies edge cases at the front of the list.",
    "Fast & slow pointers help detect cycles and find the middle.",
  ],
  "Trees": [
    "Most tree problems can be solved with DFS (recursion) or BFS (queue).",
    "Think about what the recursive function should return and what base cases are.",
    "In-order traversal of a BST gives you sorted order.",
  ],
  "Tries": [
    "A trie is a tree of characters — each node represents one character.",
    "Use a dict/map at each node to store children.",
    "Mark end-of-word with a boolean flag on the node.",
  ],
  "Heap / Priority Queue": [
    "Python: `heapq` is a min-heap. Negate values to simulate a max-heap.",
    "Good for 'top-K', 'K closest', or 'K largest' problems.",
    "Push (priority, value) tuples to control ordering.",
  ],
  "Backtracking": [
    "Build the solution incrementally, abandon (backtrack) as soon as a constraint is violated.",
    "The recursive function typically: choose, explore, un-choose.",
    "Use a `visited` set or pass an index to avoid revisiting.",
  ],
  "Graphs": [
    "Build an adjacency list first: `graph = defaultdict(list)`.",
    "DFS uses a stack (or recursion); BFS uses a queue.",
    "Mark nodes visited before exploring to avoid infinite loops.",
  ],
  "Advanced Graphs": [
    "Dijkstra's for shortest path with non-negative weights (use a min-heap).",
    "Union-Find (DSU) is efficient for connectivity problems.",
    "Topological sort works on DAGs — useful for dependency ordering.",
  ],
  "1D Dynamic Programming": [
    "Define `dp[i]` clearly — what does it represent at index i?",
    "Find the recurrence: dp[i] = f(dp[i-1], dp[i-2], ...)",
    "Start with the recursive solution + memoization, then convert to tabulation.",
  ],
  "2D Dynamic Programming": [
    "Define `dp[i][j]` — usually represents answer for first i rows, j columns.",
    "Fill the table row by row, making sure dependencies are computed first.",
    "Often the answer is `dp[m][n]`, but not always — check all cells.",
  ],
  "Greedy": [
    "Make the locally optimal choice at each step and prove it leads to the global optimum.",
    "Sorting is often the first step in greedy problems.",
    "Ask: does choosing the 'best' option now ever hurt us later?",
  ],
  "Intervals": [
    "Sort intervals by start time first.",
    "Use `max(end, prev_end)` to merge overlapping intervals.",
    "A min-heap of end times helps with meeting room type problems.",
  ],
  "Math & Geometry": [
    "Think about modular arithmetic for cyclic patterns.",
    "In-place matrix rotation: transpose then reverse rows.",
    "Use `pow(base, exp, mod)` for fast modular exponentiation.",
  ],
  "Bit Manipulation": [
    "`n & (n-1)` clears the lowest set bit.",
    "`n ^ n = 0` and `n ^ 0 = n` — XOR cancels duplicates.",
    "Left shift `<<` multiplies by 2; right shift `>>` divides by 2.",
  ],
};

function timeAgo(date) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtTotalTime(s) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function ProblemDetailPage({ params }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const problem = PROBLEMS.find(p => p.id === parseInt(id));

  const [mastery, setMasteryState] = useState("unseen");
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [lastMasteryAt, setLastMasteryAt] = useState(null);
  const [repeatCount, setRepeatCount] = useState(0);
  const [totalTimeSeconds, setTotalTimeSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);

  // Timer state
  const [elapsed, setElapsed] = useState(0);        // seconds this session
  const [timerRunning, setTimerRunning] = useState(false);
  const startRef = useRef(null);   // epoch ms when timer started
  const tickRef  = useRef(null);   // setInterval id

  // Start timer once auth is confirmed
  useEffect(() => {
    if (status !== "authenticated") return;
    startRef.current = Date.now();
    setTimerRunning(true);
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/progress")
      .then(r => r.json())
      .then(({ progress, notes, updatedAt: ua, lastMasteryAt: lm, repeatCount: rc, totalTimeSeconds: tts }) => {
        if (progress?.[problem?.id]) setMasteryState(progress[problem.id]);
        if (notes?.[problem?.id]) { setNote(notes[problem.id]); setSavedNote(notes[problem.id]); }
        if (ua?.[problem?.id]) setUpdatedAt(ua[problem.id]);
        if (lm?.[problem?.id]) setLastMasteryAt(lm[problem.id]);
        if (rc?.[problem?.id] != null) setRepeatCount(rc[problem.id]);
        if (tts?.[problem?.id] != null) setTotalTimeSeconds(tts[problem.id]);
      });
  }, [status, problem?.id]);

  if (!problem) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Problem not found.</p>
      </div>
    );
  }

  const diff = DIFF_CONFIG[problem.difficulty];
  const mstCfg = MASTERY_CONFIG[mastery];
  const due = isDue(mastery, updatedAt);
  const rvLabel = reviewLabel(mastery, updatedAt);
  const hints = CATEGORY_HINTS[problem.category] || [];
  const interval = REVIEW_INTERVALS[mastery];

  const updateMastery = async (level) => {
    // Stop timer and capture session seconds
    clearInterval(tickRef.current);
    setTimerRunning(false);
    const sessionSeconds = elapsed;

    setMasteryState(level);
    setSaving(true);
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: problem.id, mastery: level, timeSeconds: sessionSeconds }),
    });
    const data = await res.json();
    if (data.row?.updatedAt) setUpdatedAt(data.row.updatedAt);
    if (data.row?.lastMasteryAt) setLastMasteryAt(data.row.lastMasteryAt);
    if (data.row?.repeatCount != null) setRepeatCount(data.row.repeatCount);
    // Update total time displayed
    setTotalTimeSeconds(prev => prev + sessionSeconds);
    // Reset session timer to 0 (stopped)
    setElapsed(0);
    setSaving(false);
  };

  const saveNote = async () => {
    if (note === savedNote) return;
    setSaving(true);
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: problem.id, notes: note }),
    });
    setSavedNote(note);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{problem.id}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff.bgColor} ${diff.textColor}`}>
                  {problem.difficulty}
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {problem.category}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">LC #{problem.leetcode}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{problem.title}</h1>
            </div>

            {/* Spaced repetition status */}
            {mastery !== "unseen" && (
              <div className={`shrink-0 text-center px-3 py-2 rounded-xl border ${
                due
                  ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
                  : "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
              }`}>
                <p className={`text-xs font-semibold ${due ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {due ? "🔴 " : "✅ "}{rvLabel}
                </p>
                {updatedAt && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Reviewed {timeAgo(updatedAt)}
                  </p>
                )}
                {interval && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Every {interval}d
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Timer row */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${timerRunning ? "bg-green-500 animate-pulse" : "bg-gray-300 dark:bg-gray-600"}`} />
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">This Session</p>
                <p className="text-sm font-bold tabular-nums text-gray-800 dark:text-gray-200">{fmtSeconds(elapsed)}</p>
              </div>
            </div>
            {totalTimeSeconds > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Total Time</p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{fmtTotalTime(totalTimeSeconds)}</p>
              </div>
            )}
            {repeatCount > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Times Practiced</p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{repeatCount}×</p>
              </div>
            )}
          </div>

          {/* Last solved */}
          {lastMasteryAt && (
            <div className="mt-2">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Last Solved</p>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {new Date(lastMasteryAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                {new Date(lastMasteryAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </div>

        {/* Action links */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-4">
          <div className="flex gap-2 flex-wrap">
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Open on LeetCode →
            </a>
            <a
              href={`https://www.youtube.com/results?search_query=neetcode+${encodeURIComponent(problem.title)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              NeetCode Solution ▶
            </a>
            <a
              href={`https://neetcode.io/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              NeetCode.io
            </a>
          </div>
        </div>

        {/* Mastery */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mastery Level</h2>
            {saving && <span className="text-xs text-blue-500 animate-pulse">Saving…</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {MASTERY_ORDER.map(level => {
              const cfg = MASTERY_CONFIG[level];
              const active = mastery === level;
              return (
                <button
                  key={level}
                  onClick={() => updateMastery(level)}
                  disabled={status !== "authenticated"}
                  className={`text-sm font-medium px-4 py-2 rounded-xl border-2 transition-all ${
                    active
                      ? `${cfg.bgColor} ${cfg.textColor} border-current scale-105 shadow-sm`
                      : "bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {mastery !== "unseen" && interval && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              At <strong className={mstCfg.textColor}>{mstCfg.label}</strong> level — scheduled review every {interval} day{interval > 1 ? "s" : ""}.
            </p>
          )}
        </div>

        {/* Hints */}
        {hints.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl mb-4 overflow-hidden">
            <button
              onClick={() => setHintsOpen(o => !o)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                💡 {problem.category} Hints
              </h2>
              <span className="text-gray-400 dark:text-gray-500 text-xs">{hintsOpen ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {hintsOpen && (
              <div className="px-6 pb-5 flex flex-col gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                {hints.map((hint, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-blue-500 dark:text-blue-400 font-bold text-sm shrink-0">{i + 1}.</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{hint}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes — Markdown editor */}
        <MarkdownNote
          value={note}
          onChange={setNote}
          onSave={saveNote}
          saving={saving}
          disabled={status !== "authenticated"}
        />

      </div>
    </div>
  );
}
