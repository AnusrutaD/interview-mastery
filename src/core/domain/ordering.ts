/**
 * Manual ordering: moving items around and slotting new ones in between.
 *
 * Positions are dense integers (0, 1, 2, …) reassigned on every move rather
 * than sparse gaps that get subdivided. Sparse positions avoid rewriting rows,
 * but they drift — repeated inserts between the same pair eventually exhaust
 * the gap and need a rebalance anyway, and the bug that produces is invisible
 * until it isn't. A list here is at most a few hundred items, so rewriting the
 * order outright is cheap and always correct.
 *
 * Every function returns only the entries whose position actually changed, so
 * the caller writes two rows for a nudge rather than the whole list.
 */

export interface Positioned {
  id: string;
  position: number;
}

/** A position change to persist. */
export interface PositionUpdate {
  id: string;
  position: number;
}

/** Sorted by position, with id as a stable tie-break. */
export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/**
 * Diff an intended order against current positions.
 *
 * Returning only genuine changes keeps a no-op drag — pick a row up, drop it
 * back — from writing anything at all.
 */
export function toPositionUpdates<T extends Positioned>(ordered: readonly T[]): PositionUpdate[] {
  const updates: PositionUpdate[] = [];
  ordered.forEach((item, index) => {
    if (item.position !== index) updates.push({ id: item.id, position: index });
  });
  return updates;
}

/**
 * Move one item to a new index in the list.
 *
 * `toIndex` is the index in the *reordered* list, which is what a drop target
 * means. Out-of-range values are clamped rather than rejected: a drag that ends
 * past the last row should land at the end, not fail.
 */
export function moveItem<T extends Positioned>(
  items: readonly T[],
  id: string,
  toIndex: number
): T[] {
  const ordered = sortByPosition(items);
  const from = ordered.findIndex((item) => item.id === id);
  if (from === -1) return ordered;

  const to = Math.min(Math.max(0, toIndex), ordered.length - 1);
  if (from === to) return ordered;

  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Convenience for arrow buttons. Moving past either end is a no-op. */
export function nudgeItem<T extends Positioned>(
  items: readonly T[],
  id: string,
  direction: "up" | "down"
): T[] {
  const ordered = sortByPosition(items);
  const from = ordered.findIndex((item) => item.id === id);
  if (from === -1) return ordered;
  return moveItem(ordered, id, from + (direction === "up" ? -1 : 1));
}

/**
 * The position a newly inserted item should take.
 *
 * `afterId` of null means the very start. An unknown id appends, because the
 * alternative — silently inserting at 0 — puts the item somewhere the user did
 * not ask for.
 */
export function insertPositionAfter<T extends Positioned>(
  items: readonly T[],
  afterId: string | null
): number {
  const ordered = sortByPosition(items);
  if (afterId === null) return 0;

  const index = ordered.findIndex((item) => item.id === afterId);
  return index === -1 ? ordered.length : index + 1;
}

/**
 * Positions for the whole list once `count` items are inserted at `at`.
 *
 * Returned as updates for the *existing* items only — the new rows are created
 * by the caller at `at … at + count - 1`. Shifting everything below in one
 * statement is what keeps two items from sharing a position.
 */
export function shiftForInsert<T extends Positioned>(
  items: readonly T[],
  at: number,
  count: number
): PositionUpdate[] {
  if (count <= 0) return [];
  return sortByPosition(items)
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index >= at)
    .map(({ item, index }) => ({ id: item.id, position: index + count }));
}

/**
 * Whether the visible list can be reordered by dragging.
 *
 * Dragging a filtered or searched list is a trap: the rows between two visible
 * neighbours are hidden, so "drop below this one" has no single meaning. Better
 * to disable it and say why than to apply an order the user cannot see.
 */
export function canReorder(options: { filtered: boolean; sorted?: boolean }): boolean {
  return !options.filtered && !options.sorted;
}
