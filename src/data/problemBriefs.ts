/**
 * Condensed problem briefs — original content written for this app.
 *
 * These are NOT LeetCode's problem statements. They are deliberately short
 * restatements written for revision: the shape of the input, the idea the
 * solution turns on, the target complexity, and the mistake that most often
 * costs the solve. The canonical statement lives on LeetCode, one click away.
 *
 * Keyed by internal problem id (see `problems.ts`).
 */
import type { ProblemBrief } from "@/core/domain/progress";

const BRIEFS: Readonly<Record<number, ProblemBrief>> = {
  /* ── Arrays & Hashing ─────────────────────────────────────────────────── */
  1: {
    task: "Return true if any value appears more than once in an integer array.",
    insight: "A set answers 'have I seen this?' in O(1). Compare set size to array length, or bail on first repeat.",
    complexity: "O(n) time, O(n) space",
    pitfall: "Sorting first works but costs O(n log n) — only prefer it if O(1) extra space is required.",
  },
  2: {
    task: "Decide whether two strings are anagrams of each other.",
    insight: "Anagrams have identical character counts. One pass to build counts, one to cancel them out.",
    complexity: "O(n) time, O(1) space for a fixed alphabet",
    pitfall: "Check lengths first. Sorting both is a valid O(n log n) fallback if asked for no extra space.",
  },
  3: {
    task: "Find the two indices whose values sum to a target.",
    insight: "For each value, the partner you need is target − value. A hash map of value → index makes that lookup O(1).",
    complexity: "O(n) time, O(n) space",
    pitfall: "Insert into the map after checking, otherwise an element can pair with itself.",
  },
  4: {
    task: "Group words that are anagrams of one another.",
    insight: "Anagrams need a canonical key. Sorted characters works; a 26-length count tuple avoids the sort.",
    complexity: "O(n·k) time with count keys, O(n·k) space",
    pitfall: "Using a sorted string as the key costs O(k log k) per word — fine, but say why you chose it.",
  },
  5: {
    task: "Return the k most frequent elements.",
    insight: "Count with a map, then bucket by frequency: index i holds every value seen i times. Walk buckets from the top.",
    complexity: "O(n) time with bucket sort, O(n) space",
    pitfall: "A heap gives O(n log k) and is easier to write — bucket sort is the O(n) answer if pressed.",
  },
  6: {
    task: "For each index, return the product of all other elements — without division.",
    insight: "The answer is prefix product × suffix product. Two passes, accumulating each into the output array.",
    complexity: "O(n) time, O(1) extra space excluding output",
    pitfall: "The no-division constraint exists precisely because zeros break the divide-the-total trick.",
  },
  7: {
    task: "Validate a partially filled 9×9 Sudoku board.",
    insight: "Three families of constraint — row, column, 3×3 box — all checkable in one pass with a set per group.",
    complexity: "O(1) — the board is fixed size",
    pitfall: "Box index is `(r / 3) * 3 + (c / 3)`. Getting that expression wrong is the usual failure.",
  },
  8: {
    task: "Encode a list of strings into one string and decode it back.",
    insight: "Any delimiter can appear in the data. Length-prefix instead: write the length, a separator, then the string.",
    complexity: "O(n) both directions",
    pitfall: "Delimiter-only schemes are the trap the problem is built around — they cannot be made safe.",
  },
  9: {
    task: "Find the length of the longest run of consecutive integers present in an array.",
    insight: "Put everything in a set. A number starts a sequence only if n−1 is absent — count upward from those.",
    complexity: "O(n) time, O(n) space",
    pitfall: "The start check is what keeps it linear; without it you re-walk the same sequence repeatedly.",
  },

  /* ── Two Pointers ─────────────────────────────────────────────────────── */
  10: {
    task: "Check whether a string is a palindrome, ignoring case and non-alphanumerics.",
    insight: "Two pointers moving inward, skipping characters that do not count.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Guard the inner skip loops against crossing the pointers on all-punctuation input.",
  },
  11: {
    task: "In a sorted array, find two values summing to a target (1-indexed answer).",
    insight: "Sorted input means the sum is monotonic: too small → advance left, too large → retract right.",
    complexity: "O(n) time, O(1) space",
    pitfall: "The answer is 1-indexed. Easy marks lost here.",
  },
  12: {
    task: "Find all unique triplets summing to zero.",
    insight: "Sort, fix one element, then run the two-pointer scan on the remainder.",
    complexity: "O(n²) time, O(1) extra space",
    pitfall: "Deduplication is the whole difficulty — skip repeats at the fixed index and after each pointer move.",
  },
  13: {
    task: "Pick two lines forming the container holding the most water.",
    insight: "Area is bounded by the shorter line. Moving the taller one can never help, so always move the shorter.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Height is the min of the pair, width is the index gap — not the sum.",
  },
  14: {
    task: "Compute total rainwater trapped by an elevation map.",
    insight: "Water above a bar is min(maxLeft, maxRight) − height. Two pointers track both maxima in one pass.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Always advance from the side with the smaller max — that side's bound is the one that is known.",
  },

  /* ── Sliding Window ───────────────────────────────────────────────────── */
  15: {
    task: "Find the maximum profit from one buy and one later sell.",
    insight: "Track the minimum price seen so far; the best profit at each day is price − thatMinimum.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Profit cannot be negative — return 0 for a strictly falling series.",
  },
  16: {
    task: "Length of the longest substring with no repeated characters.",
    insight: "Grow the window right; on a duplicate, shrink from the left until the window is valid again.",
    complexity: "O(n) time, O(min(n, alphabet)) space",
    pitfall: "Jumping left straight past the previous occurrence is faster, but only if you never move it backwards.",
  },
  17: {
    task: "Longest substring of one repeated character after at most k replacements.",
    insight: "A window is valid when length − countOfMostFrequentChar ≤ k.",
    complexity: "O(n) time, O(1) space",
    pitfall: "The max-frequency count need not shrink when the window shrinks — the answer stays correct either way.",
  },
  18: {
    task: "Does s2 contain any permutation of s1 as a substring?",
    insight: "Fixed-size window of length |s1|; compare character counts as the window slides.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Rebuilding the count each step makes it O(n·k). Update incrementally — add one, remove one.",
  },
  19: {
    task: "Smallest substring of s containing every character of t, with multiplicity.",
    insight: "Expand until valid, then contract while still valid, recording the best. Track how many required counts are satisfied.",
    complexity: "O(n) time, O(k) space",
    pitfall: "Multiplicity matters — 'aa' in t needs two 'a's. Track a satisfied-count, not just presence.",
  },
  20: {
    task: "Maximum of every window of size k.",
    insight: "A monotonic decreasing deque of indices: the front is always the current window's max.",
    complexity: "O(n) time, O(k) space",
    pitfall: "Store indices, not values, so you can evict entries that have fallen out of the window.",
  },

  /* ── Stack ────────────────────────────────────────────────────────────── */
  21: {
    task: "Validate that brackets are correctly matched and nested.",
    insight: "Push openers; on a closer, the top of the stack must be its partner.",
    complexity: "O(n) time, O(n) space",
    pitfall: "An empty stack on a closer is invalid, and a non-empty stack at the end is too.",
  },
  22: {
    task: "Stack supporting push, pop, top and getMin, all in O(1).",
    insight: "Keep a parallel stack of minima — push the smaller of the new value and the current min.",
    complexity: "O(1) per operation, O(n) space",
    pitfall: "Push to the min stack on every push, otherwise pops desynchronise the two stacks.",
  },
  23: {
    task: "Evaluate an expression in reverse Polish notation.",
    insight: "Push numbers; on an operator, pop two and push the result.",
    complexity: "O(n) time, O(n) space",
    pitfall: "Operand order matters for − and ÷ — the first pop is the right-hand side.",
  },
  24: {
    task: "Generate all valid combinations of n pairs of parentheses.",
    insight: "Backtrack with two counters. Open is allowed while open < n; close only while close < open.",
    complexity: "O(4ⁿ / √n) — the Catalan number of results",
    pitfall: "The close < open guard is what enforces validity; without it you generate then filter.",
  },
  25: {
    task: "For each day, how many days until a warmer temperature.",
    insight: "Monotonic decreasing stack of indices. A warmer day resolves everything colder still on the stack.",
    complexity: "O(n) time, O(n) space",
    pitfall: "Unresolved indices keep their default 0 — do not overwrite them at the end.",
  },
  26: {
    task: "Count car fleets arriving at a destination.",
    insight: "Sort by position descending and compare arrival times. A car that would catch the one ahead joins its fleet.",
    complexity: "O(n log n) time, O(n) space",
    pitfall: "Compare against the current fleet's arrival time, not the immediately preceding car's.",
  },
  27: {
    task: "Largest rectangle fitting inside a histogram.",
    insight: "For each bar, extend left and right while bars are at least as tall. A monotonic increasing stack finds both bounds in one pass.",
    complexity: "O(n) time, O(n) space",
    pitfall: "When popping, the width reaches back to the index the popped bar could have started from — not the current index.",
  },

  /* ── Binary Search ────────────────────────────────────────────────────── */
  28: {
    task: "Classic binary search over a sorted array.",
    insight: "Halve the search space each step by comparing against the midpoint.",
    complexity: "O(log n) time, O(1) space",
    pitfall: "Use `left + (right − left) / 2` and be consistent about whether right is inclusive.",
  },
  29: {
    task: "Search a matrix whose rows are sorted and where each row starts after the previous ends.",
    insight: "The matrix is one sorted array reshaped. Binary search over m·n and convert index to (row, col).",
    complexity: "O(log(m·n)) time, O(1) space",
    pitfall: "row = idx / cols, col = idx % cols. Swapping those is the usual slip.",
  },
  30: {
    task: "Smallest eating speed that finishes all banana piles within h hours.",
    insight: "Binary search the *answer*, not the input. Feasibility is monotonic: if speed k works, so does k+1.",
    complexity: "O(n log maxPile) time, O(1) space",
    pitfall: "Hours for a pile is ceil(pile / k) — integer division silently truncates.",
  },
  31: {
    task: "Find the minimum in a rotated sorted array.",
    insight: "Compare mid against the rightmost element to tell which half is sorted; the minimum sits in the unsorted half.",
    complexity: "O(log n) time, O(1) space",
    pitfall: "Comparing against the left element instead needs an extra case — right is cleaner.",
  },
  32: {
    task: "Search for a target in a rotated sorted array.",
    insight: "One half is always sorted. Determine which, then check whether the target lies inside it.",
    complexity: "O(log n) time, O(1) space",
    pitfall: "Range checks must be inclusive at the sorted half's endpoints.",
  },
  33: {
    task: "Key-value store where get returns the value at or before a given timestamp.",
    insight: "Append-only per key keeps timestamps sorted, so get is a binary search for the largest timestamp ≤ target.",
    complexity: "O(1) set, O(log n) get",
    pitfall: "Return the greatest earlier value, not the nearest — later timestamps never count.",
  },
  34: {
    task: "Median of two sorted arrays in logarithmic time.",
    insight: "Binary search a partition of the smaller array such that everything left of both cuts is ≤ everything right.",
    complexity: "O(log min(m, n)) time, O(1) space",
    pitfall: "Use ±infinity sentinels at the array edges, and handle odd versus even total length separately.",
  },

  /* ── Linked List ──────────────────────────────────────────────────────── */
  35: {
    task: "Reverse a singly linked list.",
    insight: "Walk with prev/curr, re-pointing each next before advancing.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Save curr.next before overwriting it, or you lose the rest of the list.",
  },
  36: {
    task: "Merge two sorted linked lists.",
    insight: "A dummy head removes every special case around the first node.",
    complexity: "O(n + m) time, O(1) space",
    pitfall: "Attach the non-empty remainder at the end — do not stop at the shorter list.",
  },
  37: {
    task: "Reorder a list as first, last, second, second-last, …",
    insight: "Three known moves composed: find the middle, reverse the second half, then interleave.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Terminate the first half before merging, otherwise you build a cycle.",
  },
  38: {
    task: "Remove the nth node from the end.",
    insight: "Two pointers n apart. When the leading one hits the end, the trailing one is just before the target.",
    complexity: "O(n) time, one pass",
    pitfall: "Removing the head needs a dummy node, or a special case you will forget.",
  },
  39: {
    task: "Deep-copy a list where each node also has a random pointer.",
    insight: "A map from original node to its copy lets you resolve both next and random in a second pass.",
    complexity: "O(n) time, O(n) space",
    pitfall: "The O(1)-space version interleaves copies into the original list, then splits them apart.",
  },
  40: {
    task: "Add two numbers stored as reversed digit lists.",
    insight: "Reversed order means you meet the least significant digits first — add with a running carry.",
    complexity: "O(max(n, m)) time",
    pitfall: "A leftover carry after both lists end needs one more node.",
  },
  41: {
    task: "Detect whether a linked list has a cycle.",
    insight: "Fast and slow pointers. In a cycle the fast one laps the slow one; otherwise it reaches null.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Check fast and fast.next before advancing two steps.",
  },
  42: {
    task: "Find the duplicate in n+1 integers within [1, n], without modifying the array.",
    insight: "Treat values as next-pointers: the array is a linked list with a cycle, and the duplicate is its entrance.",
    complexity: "O(n) time, O(1) space",
    pitfall: "After the pointers meet, restart one at index 0 — the second meeting point is the answer.",
  },
  43: {
    task: "LRU cache with O(1) get and put.",
    insight: "Hash map for lookup plus a doubly linked list for order. The map stores nodes so unlinking is O(1).",
    complexity: "O(1) per operation",
    pitfall: "get is also a use — it must move the node to the front, not just return the value.",
  },
  44: {
    task: "Merge k sorted linked lists.",
    insight: "Pair up and merge repeatedly — like merge sort's combine step — rather than folding one at a time.",
    complexity: "O(N log k) time, O(1) space for pairwise merging",
    pitfall: "Sequential merging is O(N·k). A min-heap of heads is the other O(N log k) answer.",
  },
  45: {
    task: "Reverse the list in consecutive groups of k.",
    insight: "Per group: verify k nodes remain, reverse them, then reconnect to the previous group's tail.",
    complexity: "O(n) time, O(1) space",
    pitfall: "A trailing group shorter than k is left untouched — check before reversing, not after.",
  },

  /* ── Trees ────────────────────────────────────────────────────────────── */
  46: {
    task: "Mirror a binary tree left-to-right.",
    insight: "Swap each node's children, then recurse. Order of swap and recursion does not matter.",
    complexity: "O(n) time, O(h) space",
    pitfall: "Null check first — the base case is the whole termination condition.",
  },
  47: {
    task: "Depth of the deepest leaf.",
    insight: "1 + max(depth of left, depth of right).",
    complexity: "O(n) time, O(h) space",
    pitfall: "An empty tree is depth 0, not 1.",
  },
  48: {
    task: "Longest path between any two nodes, measured in edges.",
    insight: "At each node the best local path is leftHeight + rightHeight. Return height upward, track the diameter in a side variable.",
    complexity: "O(n) time, O(h) space",
    pitfall: "The answer need not pass through the root — that is why it is tracked separately from the return value.",
  },
  49: {
    task: "Is every node's subtree height difference at most 1?",
    insight: "Compute height and balance together — return −1 (or a flag) upward to short-circuit once imbalance is found.",
    complexity: "O(n) time, O(h) space",
    pitfall: "Calling a separate height() inside the recursion makes it O(n²).",
  },
  50: {
    task: "Are two binary trees structurally identical with equal values?",
    insight: "Compare roots, then recurse pairwise on both children.",
    complexity: "O(n) time, O(h) space",
    pitfall: "Both-null is true; one-null is false. Handle those before dereferencing.",
  },
  51: {
    task: "Does one tree contain another as a subtree?",
    insight: "At every node of the big tree, run the same-tree check.",
    complexity: "O(n·m) worst case",
    pitfall: "A subtree must match from that node all the way down — a partial match does not count.",
  },
  52: {
    task: "Lowest common ancestor in a binary search tree.",
    insight: "The BST ordering tells you which way to go. The split point — where the targets diverge — is the LCA.",
    complexity: "O(h) time, O(1) space iteratively",
    pitfall: "A node can be its own ancestor; stop as soon as the values straddle the current node.",
  },
  53: {
    task: "Return node values level by level.",
    insight: "BFS with a queue, processing exactly the current queue length per level.",
    complexity: "O(n) time, O(n) space",
    pitfall: "Snapshot the queue size before the inner loop — it grows as you enqueue children.",
  },
  54: {
    task: "Values visible when viewing the tree from the right.",
    insight: "Level-order traversal, keeping the last node of each level.",
    complexity: "O(n) time, O(n) space",
    pitfall: "A deep left subtree is visible when the right side is shorter — take the last per level, not the rightmost path.",
  },
  55: {
    task: "Count nodes with no larger value on the path from the root.",
    insight: "Carry the running maximum down the recursion; a node counts when it is at least that maximum.",
    complexity: "O(n) time, O(h) space",
    pitfall: "The root always counts. Seed the maximum with the root's value or negative infinity.",
  },
  56: {
    task: "Validate that a binary tree is a BST.",
    insight: "Every node must fall inside an open (min, max) range that tightens as you descend.",
    complexity: "O(n) time, O(h) space",
    pitfall: "Comparing only against immediate children passes invalid trees — the constraint is global.",
  },
  57: {
    task: "Kth smallest value in a BST.",
    insight: "In-order traversal visits a BST in sorted order. Stop at the kth node.",
    complexity: "O(h + k) time, O(h) space",
    pitfall: "An iterative stack lets you stop early; full recursion visits everything.",
  },
  58: {
    task: "Rebuild a binary tree from preorder and inorder traversals.",
    insight: "Preorder's first element is the root; its position in inorder splits the left and right subtrees.",
    complexity: "O(n) with an index map, O(n) space",
    pitfall: "Scanning inorder for the root each call makes it O(n²) — precompute value → index.",
  },
  59: {
    task: "Maximum path sum between any two nodes.",
    insight: "Each node returns the best single downward branch; the best path *through* it is left + node + right, tracked globally.",
    complexity: "O(n) time, O(h) space",
    pitfall: "Clamp negative branch sums to 0 — a harmful branch is simply not taken.",
  },
  60: {
    task: "Serialise a binary tree to a string and reconstruct it.",
    insight: "Preorder with explicit null markers is unambiguous and rebuilds in a single left-to-right pass.",
    complexity: "O(n) both directions",
    pitfall: "Nulls must be encoded. Without them the structure cannot be recovered from one traversal.",
  },

  /* ── Tries ────────────────────────────────────────────────────────────── */
  61: {
    task: "Implement a prefix tree with insert, search and startsWith.",
    insight: "Each node holds a map of children plus an end-of-word flag. Words are paths, not stored strings.",
    complexity: "O(k) per operation for word length k",
    pitfall: "search requires the end-of-word flag; startsWith only requires the path to exist.",
  },
  62: {
    task: "Trie supporting '.' as a single-character wildcard.",
    insight: "A literal descends one child; a dot branches into all of them, so search becomes a DFS.",
    complexity: "O(k) typical, O(26^k) worst case with many dots",
    pitfall: "Any branch returning true short-circuits the whole search.",
  },
  63: {
    task: "Find every dictionary word present in a character grid.",
    insight: "Build a trie of the words, then DFS the grid once, pruning the moment the current path leaves the trie.",
    complexity: "O(m·n·4^L) worst case, heavily pruned in practice",
    pitfall: "Searching each word independently is far too slow — the trie is what makes one shared traversal possible.",
  },

  /* ── Heap / Priority Queue ────────────────────────────────────────────── */
  64: {
    task: "Stream of numbers; report the kth largest after each addition.",
    insight: "A min-heap capped at size k — its root is exactly the kth largest.",
    complexity: "O(log k) per add",
    pitfall: "Min-heap for kth *largest* feels inverted; keeping the k biggest is the point.",
  },
  65: {
    task: "Repeatedly smash the two heaviest stones; return what remains.",
    insight: "A max-heap gives the two largest in O(log n); push the difference back when non-zero.",
    complexity: "O(n log n) time, O(n) space",
    pitfall: "Languages with only a min-heap need negated values.",
  },
  66: {
    task: "The k points closest to the origin.",
    insight: "Order by squared distance — the square root is monotonic and unnecessary.",
    complexity: "O(n log k) with a bounded heap",
    pitfall: "Quickselect gives O(n) average if asked to beat the heap.",
  },
  67: {
    task: "Kth largest element in an unsorted array.",
    insight: "Quickselect: partition and recurse into only the side containing the target index.",
    complexity: "O(n) average, O(n²) worst; heap gives guaranteed O(n log k)",
    pitfall: "Convert kth largest to a 0-based index carefully: n − k.",
  },
  68: {
    task: "Minimum time to run tasks with a cooldown between identical ones.",
    insight: "The most frequent task sets the skeleton: (maxCount − 1) × (n + 1) + numberOfTasksAtMaxCount.",
    complexity: "O(n) time, O(1) space",
    pitfall: "The answer is never less than the total task count — take the max of the two.",
  },
  69: {
    task: "Mini Twitter: post, follow, unfollow, and a feed of 10 recent tweets.",
    insight: "Store tweets per user with a global counter for ordering; merge followees' latest with a heap at read time.",
    complexity: "O(f log f) per feed for f followees",
    pitfall: "A user follows themselves implicitly — their own tweets must appear.",
  },
  70: {
    task: "Median of a growing stream of numbers.",
    insight: "Two heaps: a max-heap for the lower half, a min-heap for the upper. Keep sizes within one.",
    complexity: "O(log n) add, O(1) median",
    pitfall: "Rebalance after every insert, and pick the median by comparing sizes rather than assuming.",
  },

  /* ── Backtracking ─────────────────────────────────────────────────────── */
  71: {
    task: "All subsets of a distinct-element array.",
    insight: "At each index, branch on include versus exclude.",
    complexity: "O(n·2ⁿ)",
    pitfall: "Copy the running list when recording a result — it is mutated on the way back up.",
  },
  72: {
    task: "All combinations summing to a target; numbers may repeat.",
    insight: "Reuse is allowed, so recurse at the *same* index after choosing an element.",
    complexity: "Exponential in target / minimum candidate",
    pitfall: "Advancing the index after choosing forbids reuse — that is the sibling problem.",
  },
  73: {
    task: "Combinations summing to a target, each element used once, no duplicate combinations.",
    insight: "Sort first, then skip a candidate equal to its predecessor at the same recursion depth.",
    complexity: "O(2ⁿ)",
    pitfall: "The skip applies to siblings only — a duplicate deeper in the path is legitimate.",
  },
  74: {
    task: "All permutations of distinct integers.",
    insight: "Pick each unused element in turn; a used-flags array or in-place swapping both work.",
    complexity: "O(n·n!)",
    pitfall: "Undo the choice after recursing — the missing un-mark is the classic bug.",
  },
  75: {
    task: "All unique subsets when duplicates are present.",
    insight: "Sort, then at each depth skip a value identical to the previous sibling.",
    complexity: "O(n·2ⁿ)",
    pitfall: "Deduping the final list with a set works but misses the point of the exercise.",
  },
  76: {
    task: "Does a word exist as a path of adjacent cells in a grid?",
    insight: "DFS from every cell, marking visited cells during the path and restoring them afterwards.",
    complexity: "O(m·n·4^L)",
    pitfall: "Restore the cell on the way out, or later branches see a corrupted board.",
  },
  77: {
    task: "All partitions of a string where every part is a palindrome.",
    insight: "Try each prefix; if it is a palindrome, recurse on the remainder.",
    complexity: "O(n·2ⁿ)",
    pitfall: "Precomputing palindrome checks with DP avoids re-verifying the same substrings repeatedly.",
  },
  78: {
    task: "All letter combinations a phone number could spell.",
    insight: "Cartesian product across digits — recurse one digit at a time.",
    complexity: "O(4ⁿ)",
    pitfall: "Empty input returns an empty list, not a list containing an empty string.",
  },
  79: {
    task: "Place n queens on an n×n board with no mutual attacks.",
    insight: "One queen per row; track attacked columns and both diagonals as sets for O(1) checks.",
    complexity: "O(n!)",
    pitfall: "Diagonals key on (row + col) and (row − col) — mixing them up silently breaks pruning.",
  },

  /* ── Graphs ───────────────────────────────────────────────────────────── */
  80: {
    task: "Count connected landmasses in a grid.",
    insight: "Every unvisited land cell starts a flood fill that consumes its whole island.",
    complexity: "O(m·n) time, O(m·n) space",
    pitfall: "Mark visited when enqueueing, not when dequeuing, or cells are processed twice.",
  },
  81: {
    task: "Deep-copy an undirected graph.",
    insight: "A map from original node to clone doubles as the visited set and breaks cycles.",
    complexity: "O(V + E)",
    pitfall: "Check the map before recursing — a cycle otherwise loops forever.",
  },
  82: {
    task: "Size of the largest island.",
    insight: "Same flood fill as counting islands, returning area instead of incrementing a counter.",
    complexity: "O(m·n)",
    pitfall: "Area is 1 + the sum of the four recursive calls, and 0 for water.",
  },
  83: {
    task: "Cells from which water can reach both oceans.",
    insight: "Invert the problem — search *inland from* each ocean's border, then intersect the two reachable sets.",
    complexity: "O(m·n)",
    pitfall: "Searching outward from every cell is O((m·n)²). The reversal is the whole trick.",
  },
  84: {
    task: "Capture regions of 'O' fully surrounded by 'X'.",
    insight: "Anything connected to the border survives. Mark those first, then flip everything else.",
    complexity: "O(m·n)",
    pitfall: "Work border-inward; deciding per-region whether it touched an edge is far messier.",
  },
  85: {
    task: "Minutes until every fresh orange rots, or −1.",
    insight: "Multi-source BFS seeded with every rotten orange at once — BFS levels are minutes.",
    complexity: "O(m·n)",
    pitfall: "Count fresh oranges up front so you can detect unreachable ones at the end.",
  },
  86: {
    task: "Distance from each empty room to its nearest gate.",
    insight: "Multi-source BFS from all gates simultaneously; first arrival is the shortest distance.",
    complexity: "O(m·n)",
    pitfall: "BFS from each empty room instead is O((m·n)²).",
  },
  87: {
    task: "Can all courses be finished given prerequisites?",
    insight: "This asks whether a directed graph is acyclic. DFS with a recursion-stack marker, or Kahn's algorithm.",
    complexity: "O(V + E)",
    pitfall: "Distinguish 'currently on the stack' from 'fully explored' — only the former indicates a cycle.",
  },
  88: {
    task: "Return a valid course order.",
    insight: "Topological sort. Kahn's algorithm repeatedly removes a zero-in-degree node.",
    complexity: "O(V + E)",
    pitfall: "If the output is shorter than the course count, a cycle exists — return empty.",
  },
  89: {
    task: "Do the given edges form a valid tree?",
    insight: "A tree on n nodes has exactly n−1 edges and is fully connected. Check both.",
    complexity: "O(V + E)",
    pitfall: "The edge count alone is insufficient — a cycle plus a detached node satisfies it.",
  },
  90: {
    task: "Count connected components in an undirected graph.",
    insight: "Union-Find: start with n components and decrement on each successful union.",
    complexity: "O(E·α(n)) — effectively linear",
    pitfall: "Only decrement when the two roots actually differ.",
  },
  91: {
    task: "Find the edge that turns a tree into a graph with one cycle.",
    insight: "Union-Find in input order — the first edge whose endpoints already share a root is the answer.",
    complexity: "O(E·α(n))",
    pitfall: "The problem wants the *last* such edge in input order; process forwards and keep the latest.",
  },
  92: {
    task: "Shortest transformation sequence between two words, one letter at a time.",
    insight: "BFS over words as nodes. Generate neighbours by wildcarding each position rather than comparing all pairs.",
    complexity: "O(N·L²) with wildcard buckets",
    pitfall: "Comparing every word against every other is O(N²·L) and times out.",
  },

  /* ── Advanced Graphs ──────────────────────────────────────────────────── */
  93: {
    task: "Reconstruct an itinerary using every ticket exactly once, lexicographically smallest.",
    insight: "Hierholzer's algorithm for an Eulerian path — walk greedily, then build the route in reverse on the way out.",
    complexity: "O(E log E) for the sorting",
    pitfall: "Append to the result *after* exhausting a node's edges, then reverse at the end.",
  },
  94: {
    task: "Minimum cost to connect all points with Manhattan distance.",
    insight: "Minimum spanning tree. Prim's with a heap suits the dense implicit graph.",
    complexity: "O(n² log n) with a heap",
    pitfall: "Every pair is an edge — do not materialise all n² of them if you can avoid it.",
  },
  95: {
    task: "Time for a signal to reach every node from a source.",
    insight: "Dijkstra's shortest path; the answer is the maximum of the shortest distances.",
    complexity: "O(E log V)",
    pitfall: "Any unreachable node means −1 — check coverage before taking the maximum.",
  },
  96: {
    task: "Least time until a path exists from corner to corner as water rises.",
    insight: "Minimise the maximum elevation along a path — Dijkstra where the cost is max rather than sum.",
    complexity: "O(n² log n)",
    pitfall: "Relax with max(currentCost, cellHeight), not a running sum.",
  },
  97: {
    task: "Derive the letter order of an alien alphabet from sorted words.",
    insight: "Adjacent word pairs yield ordering constraints; topologically sort the resulting graph.",
    complexity: "O(total characters)",
    pitfall: "A longer word preceding its own prefix is invalid input — detect it explicitly.",
  },
  98: {
    task: "Cheapest flight with at most k stops.",
    insight: "Bellman-Ford limited to k+1 relaxation rounds — the round count naturally bounds the stops.",
    complexity: "O(k·E)",
    pitfall: "Relax from a snapshot of the previous round, or one round can chain multiple hops.",
  },

  /* ── 1D Dynamic Programming ───────────────────────────────────────────── */
  99: {
    task: "Number of ways to climb n stairs taking 1 or 2 steps.",
    insight: "ways(n) = ways(n−1) + ways(n−2) — Fibonacci with different seeds.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Two rolling variables suffice; the array is unnecessary.",
  },
  100: {
    task: "Cheapest way to reach the top of a staircase with per-step costs.",
    insight: "cost to reach i = cost[i] + min(reach i−1, reach i−2).",
    complexity: "O(n) time, O(1) space",
    pitfall: "You may start at index 0 or 1, and the top is one past the last step.",
  },
  101: {
    task: "Maximum sum of non-adjacent house values.",
    insight: "At each house: rob it and skip the previous, or skip it and keep the best so far.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Two rolling values, not an array — and mind the update order.",
  },
  102: {
    task: "House robber where the houses form a circle.",
    insight: "First and last are adjacent, so run the linear version twice: excluding the first, then excluding the last.",
    complexity: "O(n) time, O(1) space",
    pitfall: "A single-house input must be handled before splitting the range.",
  },
  103: {
    task: "Longest palindromic substring.",
    insight: "Expand around each of the 2n−1 centres — every character and every gap.",
    complexity: "O(n²) time, O(1) space",
    pitfall: "Even-length palindromes need gap centres; handling only characters misses them.",
  },
  104: {
    task: "Count palindromic substrings.",
    insight: "Same centre expansion, counting every valid expansion instead of tracking the longest.",
    complexity: "O(n²) time, O(1) space",
    pitfall: "Single characters are palindromes and must be counted.",
  },
  105: {
    task: "Number of ways to decode a digit string as letters A–Z.",
    insight: "ways(i) = ways(i−1) if the single digit is valid, plus ways(i−2) if the pair is 10–26.",
    complexity: "O(n) time, O(1) space",
    pitfall: "'0' is never valid alone and only survives inside 10 or 20.",
  },
  106: {
    task: "Fewest coins summing to an amount.",
    insight: "Unbounded knapsack: dp[a] = 1 + min over coins of dp[a − coin].",
    complexity: "O(amount·coins) time, O(amount) space",
    pitfall: "Initialise with a sentinel above the maximum and return −1 if it survives.",
  },
  107: {
    task: "Maximum product of a contiguous subarray.",
    insight: "Track running maximum *and* minimum — a negative flips them, and the minimum may become the maximum.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Compute both new values from the old pair before assigning either.",
  },
  108: {
    task: "Can a string be segmented into dictionary words?",
    insight: "dp[i] is true when some j < i has dp[j] true and s[j..i] in the dictionary.",
    complexity: "O(n²·k) time, O(n) space",
    pitfall: "dp[0] = true — the empty prefix is always segmentable.",
  },
  109: {
    task: "Length of the longest strictly increasing subsequence.",
    insight: "O(n²) DP is the natural answer; patience sorting with binary search reaches O(n log n).",
    complexity: "O(n log n) time, O(n) space",
    pitfall: "The tails array built by the fast version is not itself a valid subsequence — only its length is meaningful.",
  },
  110: {
    task: "Can the array be split into two equal-sum halves?",
    insight: "Subset-sum for total/2. A boolean set of reachable sums is enough.",
    complexity: "O(n·sum) time, O(sum) space",
    pitfall: "An odd total is immediately false — check before doing any work.",
  },

  /* ── 2D Dynamic Programming ───────────────────────────────────────────── */
  111: {
    task: "Count paths across a grid moving only right or down.",
    insight: "paths(r, c) = paths(r−1, c) + paths(r, c−1), with edges seeded to 1.",
    complexity: "O(m·n) time, O(n) space with one rolling row",
    pitfall: "It is also the binomial C(m+n−2, m−1) if you want O(1) space.",
  },
  112: {
    task: "Length of the longest common subsequence of two strings.",
    insight: "Matching characters extend the diagonal by 1; otherwise take the better of dropping one character from either side.",
    complexity: "O(m·n) time, O(min(m, n)) space",
    pitfall: "Subsequence, not substring — the characters need not be contiguous.",
  },
  113: {
    task: "Maximum stock profit with unlimited trades and a one-day cooldown after selling.",
    insight: "Three states per day — holding, just sold, free — with fixed transitions between them.",
    complexity: "O(n) time, O(1) space",
    pitfall: "The cooldown forbids buying the day after a sale, not the day of it.",
  },
  114: {
    task: "Number of coin combinations making an amount.",
    insight: "Unbounded knapsack counting combinations: loop coins outermost so order does not matter.",
    complexity: "O(amount·coins) time, O(amount) space",
    pitfall: "Looping amount outermost counts permutations instead — a different problem.",
  },
  115: {
    task: "Ways to assign + and − to reach a target sum.",
    insight: "Choosing a positive subset P gives sum(P) = (total + target) / 2, turning it into subset-count.",
    complexity: "O(n·sum) time",
    pitfall: "Impossible when (total + target) is odd or negative — check before the DP.",
  },
  116: {
    task: "Can s3 be formed by interleaving s1 and s2 while preserving order?",
    insight: "dp[i][j] — can the first i of s1 and first j of s2 build the first i+j of s3.",
    complexity: "O(m·n) time, O(n) space",
    pitfall: "Length mismatch is an immediate false; greedy matching is wrong.",
  },
  117: {
    task: "Longest strictly increasing path in a matrix.",
    insight: "DFS with memoisation. Strict increase means no cycles, so no visited set is needed.",
    complexity: "O(m·n) time and space",
    pitfall: "Without memoisation this is exponential — the cache is the solution.",
  },
  118: {
    task: "Count distinct subsequences of s equal to t.",
    insight: "dp[i][j] = skip the character in s, plus (if it matches) the diagonal count using it.",
    complexity: "O(m·n) time, O(n) space",
    pitfall: "An empty t has exactly one match from any prefix — seed that row to 1.",
  },
  119: {
    task: "Minimum insert/delete/replace operations to turn one string into another.",
    insight: "On a match take the diagonal; otherwise 1 + min of the three neighbouring states.",
    complexity: "O(m·n) time, O(n) space",
    pitfall: "Seed the first row and column to their indices — converting to or from empty costs one op per character.",
  },
  120: {
    task: "Maximum coins from bursting balloons in some order.",
    insight: "Reverse the framing: pick which balloon bursts *last* in a range, so its neighbours are the range's boundaries.",
    complexity: "O(n³) time, O(n²) space",
    pitfall: "Thinking forwards fails — the neighbours keep changing. Pad the array with 1s at both ends.",
  },
  121: {
    task: "Regex matching supporting '.' and '*'.",
    insight: "'*' means zero occurrences (skip the pair) or one more (consume a character if it matches).",
    complexity: "O(m·n) time and space",
    pitfall: "'*' binds to the character before it — the two must be handled as a unit.",
  },

  /* ── Greedy ───────────────────────────────────────────────────────────── */
  122: {
    task: "Largest sum of a contiguous subarray.",
    insight: "Kadane's: extend the running sum, or restart from here if the running sum has gone negative.",
    complexity: "O(n) time, O(1) space",
    pitfall: "An all-negative array should return the largest single element, not 0.",
  },
  123: {
    task: "Can you reach the last index given per-index jump lengths?",
    insight: "Track the furthest reachable index; fail the moment the current index exceeds it.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Walking backwards from the goal is equally valid and sometimes clearer.",
  },
  124: {
    task: "Fewest jumps to reach the last index.",
    insight: "BFS in disguise — treat each jump as a level and expand the window of reachable indices.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Increment the jump count when you exhaust the current level's window, not on every step.",
  },
  125: {
    task: "Find the circular starting station from which you can complete the loop.",
    insight: "If total gas ≥ total cost a solution exists; the start is just after wherever the running tank goes negative.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Reset the tank *and* move the candidate start together — only one of the two is not enough.",
  },
  126: {
    task: "Can the hand be split into consecutive groups of a given size?",
    insight: "Always start a group at the smallest remaining card — it has no other home.",
    complexity: "O(n log n) time",
    pitfall: "Decrement counts as you consume cards, and fail immediately if a needed card is missing.",
  },
  127: {
    task: "Can chosen triplets be combined by element-wise max to form a target?",
    insight: "Only triplets where no component exceeds the target are usable; combine those and compare.",
    complexity: "O(n) time, O(1) space",
    pitfall: "A single oversized component disqualifies the whole triplet.",
  },
  128: {
    task: "Split a string so each letter appears in at most one part, maximising the number of parts.",
    insight: "Record each letter's last index; a part ends when the scan reaches the furthest last-index seen so far.",
    complexity: "O(n) time, O(1) space",
    pitfall: "The boundary is the running maximum of last-indices, not the current letter's own.",
  },
  129: {
    task: "Validate parentheses where '*' can be '(', ')' or empty.",
    insight: "Track a range of possible open counts — a low and a high bound — instead of a single count.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Clamp the low bound at 0, and fail as soon as the high bound goes negative.",
  },

  /* ── Intervals ────────────────────────────────────────────────────────── */
  130: {
    task: "Insert an interval into a sorted non-overlapping list, merging as needed.",
    insight: "Three phases: intervals entirely before, the overlapping run to merge, then everything after.",
    complexity: "O(n) time",
    pitfall: "Touching endpoints count as overlapping — use ≤ rather than <.",
  },
  131: {
    task: "Merge all overlapping intervals.",
    insight: "Sort by start; extend the current interval's end while the next one starts before it.",
    complexity: "O(n log n) time",
    pitfall: "Extend with max(end, next.end) — a fully contained interval must not shrink it.",
  },
  132: {
    task: "Fewest intervals to remove so none overlap.",
    insight: "Sort by *end*; greedily keep the earliest-finishing interval, which leaves the most room.",
    complexity: "O(n log n) time",
    pitfall: "Sorting by start needs an extra rule for which of two overlapping intervals to drop.",
  },
  133: {
    task: "Can a person attend all meetings?",
    insight: "Sort by start; any meeting beginning before the previous ends is a conflict.",
    complexity: "O(n log n) time",
    pitfall: "A meeting ending exactly when the next begins is not a conflict.",
  },
  134: {
    task: "Minimum meeting rooms required.",
    insight: "A min-heap of end times — reuse a room when its meeting has finished; heap size is the answer.",
    complexity: "O(n log n) time",
    pitfall: "Separately sorted start and end arrays with two pointers is the equivalent O(n log n) alternative.",
  },
  135: {
    task: "For each query, the size of the smallest interval containing it.",
    insight: "Sort queries and intervals; a min-heap keyed by size holds the currently active intervals.",
    complexity: "O((n + q) log n) time",
    pitfall: "Evict expired intervals from the heap before answering each query.",
  },

  /* ── Math & Geometry ──────────────────────────────────────────────────── */
  136: {
    task: "Rotate an n×n matrix 90° clockwise in place.",
    insight: "Transpose, then reverse each row.",
    complexity: "O(n²) time, O(1) space",
    pitfall: "Transpose only the upper triangle — going over the whole matrix undoes the swap.",
  },
  137: {
    task: "Return matrix elements in spiral order.",
    insight: "Maintain four shrinking boundaries and walk right, down, left, up in turn.",
    complexity: "O(m·n) time",
    pitfall: "Re-check the boundaries before the left and up passes, or a single remaining row is traversed twice.",
  },
  138: {
    task: "Zero out the row and column of every zero, in place.",
    insight: "Use the first row and column as the marker storage instead of separate arrays.",
    complexity: "O(m·n) time, O(1) space",
    pitfall: "Record separately whether the first row and column themselves contained a zero, and apply them last.",
  },
  139: {
    task: "Does repeatedly summing squared digits reach 1?",
    insight: "The sequence either reaches 1 or enters a cycle — detect the cycle with a set or Floyd's algorithm.",
    complexity: "O(log n) per step, bounded iterations",
    pitfall: "Without cycle detection a non-happy number loops forever.",
  },
  140: {
    task: "Add one to a number represented as a digit array.",
    insight: "Walk from the end; a digit below 9 increments and you are done, otherwise it becomes 0 and carries.",
    complexity: "O(n) time",
    pitfall: "All nines needs a longer array with a leading 1.",
  },
  141: {
    task: "Compute x raised to n.",
    insight: "Fast exponentiation — square the base and halve the exponent.",
    complexity: "O(log n) time",
    pitfall: "Negative n means reciprocal; watch for integer overflow when negating the minimum value.",
  },
  142: {
    task: "Multiply two numbers given as strings.",
    insight: "Schoolbook multiplication — digits i and j contribute to result positions i+j and i+j+1.",
    complexity: "O(m·n) time",
    pitfall: "Strip leading zeros at the end, and return '0' rather than an empty string.",
  },
  143: {
    task: "Data structure counting axis-aligned squares through a queried point.",
    insight: "For each stored point sharing no coordinate with the query, treat the pair as a diagonal and check the other two corners exist.",
    complexity: "O(n) per count query",
    pitfall: "Skip points on the same row or column — they cannot form a diagonal.",
  },

  /* ── Bit Manipulation ─────────────────────────────────────────────────── */
  144: {
    task: "Find the element appearing once when all others appear twice.",
    insight: "XOR cancels pairs and leaves the singleton, since a ^ a = 0.",
    complexity: "O(n) time, O(1) space",
    pitfall: "Only works because every other element appears an even number of times.",
  },
  145: {
    task: "Count set bits in an integer.",
    insight: "`n & (n − 1)` clears the lowest set bit — loop until zero for one iteration per set bit.",
    complexity: "O(number of set bits)",
    pitfall: "Shifting 32 times works but is slower and needs care with sign extension.",
  },
  146: {
    task: "Count set bits for every integer from 0 to n.",
    insight: "bits(i) = bits(i >> 1) + (i & 1) — reuse the already-computed half.",
    complexity: "O(n) time, O(n) space",
    pitfall: "Calling the single-number routine per value is O(n log n) and misses the point.",
  },
  147: {
    task: "Reverse the bits of a 32-bit integer.",
    insight: "Shift the result left, take the input's lowest bit, then shift the input right — 32 times.",
    complexity: "O(1) — fixed width",
    pitfall: "Languages without unsigned ints need a logical right shift, not arithmetic.",
  },
  148: {
    task: "Find the missing value in [0, n].",
    insight: "XOR every index and every value — everything present cancels, leaving the missing one.",
    complexity: "O(n) time, O(1) space",
    pitfall: "The Gauss sum formula also works but can overflow on large n.",
  },
  149: {
    task: "Add two integers without + or −.",
    insight: "XOR is addition without carry; AND shifted left is the carry. Repeat until the carry is zero.",
    complexity: "O(1) — bounded by word size",
    pitfall: "Negative numbers need explicit 32-bit masking in languages with arbitrary-precision ints.",
  },
  150: {
    task: "Reverse the digits of a signed 32-bit integer, returning 0 on overflow.",
    insight: "Pop digits with %10 and push with ×10, checking against the 32-bit bounds before each push.",
    complexity: "O(log n) time",
    pitfall: "Check for overflow *before* it happens — detecting it afterwards is already undefined.",
  },
};

export function getProblemBrief(problemId: number): ProblemBrief | null {
  return BRIEFS[problemId] ?? null;
}

export function hasProblemBrief(problemId: number): boolean {
  return problemId in BRIEFS;
}

/** Exposed for the coverage test. */
export const BRIEF_IDS: readonly number[] = Object.keys(BRIEFS).map(Number);

export default BRIEFS;
