/**
 * Presentation + teaching metadata for problem categories.
 *
 * Previously the hints lived inline in the problem detail page component,
 * making a 200-line data blob part of a rendering module.
 */

const CATEGORY_ICONS: Readonly<Record<string, string>> = {
  "Arrays & Hashing":          "📊",
  "Two Pointers":               "👆",
  "Sliding Window":             "🪟",
  "Stack":                      "📚",
  "Binary Search":              "🔍",
  "Linked List":                "🔗",
  "Trees":                      "🌳",
  "Tries":                      "🌲",
  "Heap / Priority Queue":      "⬆️",
  "Backtracking":               "↩️",
  "Graphs":                     "🕸️",
  "Advanced Graphs":            "🗺️",
  "1D Dynamic Programming":     "📈",
  "2D Dynamic Programming":     "📉",
  "Greedy":                     "⚡",
  "Intervals":                  "📅",
  "Math & Geometry":            "📐",
  "Bit Manipulation":           "🔢",
};

const DEFAULT_ICON = "\ud83d\udccc";

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? DEFAULT_ICON;
}

/** Approach hints surfaced on the problem detail page. */
export const CATEGORY_HINTS: Readonly<Record<string, readonly string[]>> = {
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

export function categoryHints(category: string): readonly string[] {
  return CATEGORY_HINTS[category] ?? [];
}
