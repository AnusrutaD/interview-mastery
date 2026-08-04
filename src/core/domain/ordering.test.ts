import { describe, expect, it } from "vitest";
import {
  canReorder,
  insertPositionAfter,
  moveItem,
  nudgeItem,
  shiftForInsert,
  sortByPosition,
  toPositionUpdates,
} from "./ordering";

const list = (...ids: string[]) => ids.map((id, position) => ({ id, position }));
const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);

describe("sortByPosition", () => {
  it("orders by position", () => {
    expect(ids(sortByPosition([{ id: "b", position: 2 }, { id: "a", position: 1 }]))).toEqual([
      "a",
      "b",
    ]);
  });

  /** Duplicate positions are possible in legacy data; order must still be stable. */
  it("breaks ties on id so the order never flickers", () => {
    const shuffled = [
      { id: "c", position: 0 },
      { id: "a", position: 0 },
      { id: "b", position: 0 },
    ];
    expect(ids(sortByPosition(shuffled))).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const original = [{ id: "b", position: 2 }, { id: "a", position: 1 }];
    sortByPosition(original);
    expect(ids(original)).toEqual(["b", "a"]);
  });
});

describe("moveItem", () => {
  it("moves an item down", () => {
    expect(ids(moveItem(list("a", "b", "c", "d"), "a", 2))).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item up", () => {
    expect(ids(moveItem(list("a", "b", "c", "d"), "d", 1))).toEqual(["a", "d", "b", "c"]);
  });

  /** A drag released past the last row should land at the end, not fail. */
  it("clamps an out-of-range target instead of rejecting it", () => {
    expect(ids(moveItem(list("a", "b", "c"), "a", 99))).toEqual(["b", "c", "a"]);
    expect(ids(moveItem(list("a", "b", "c"), "c", -5))).toEqual(["c", "a", "b"]);
  });

  it("is a no-op when the item is already there", () => {
    expect(ids(moveItem(list("a", "b", "c"), "b", 1))).toEqual(["a", "b", "c"]);
  });

  it("ignores an unknown id", () => {
    expect(ids(moveItem(list("a", "b"), "zz", 0))).toEqual(["a", "b"]);
  });
});

describe("nudgeItem", () => {
  it("swaps with the neighbour", () => {
    expect(ids(nudgeItem(list("a", "b", "c"), "b", "up"))).toEqual(["b", "a", "c"]);
    expect(ids(nudgeItem(list("a", "b", "c"), "b", "down"))).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the ends", () => {
    expect(ids(nudgeItem(list("a", "b"), "a", "up"))).toEqual(["a", "b"]);
    expect(ids(nudgeItem(list("a", "b"), "b", "down"))).toEqual(["a", "b"]);
  });
});

describe("toPositionUpdates", () => {
  /** A drag that ends where it started must not write anything. */
  it("returns nothing when the order is unchanged", () => {
    expect(toPositionUpdates(list("a", "b", "c"))).toEqual([]);
  });

  it("returns only the rows that actually moved", () => {
    const reordered = moveItem(list("a", "b", "c", "d"), "a", 1);
    expect(toPositionUpdates(reordered)).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ]);
  });

  it("assigns dense positions from zero", () => {
    const sparse = [
      { id: "a", position: 10 },
      { id: "b", position: 20 },
    ];
    expect(toPositionUpdates(sortByPosition(sparse))).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });
});

describe("insertPositionAfter", () => {
  it("inserts after the given item", () => {
    expect(insertPositionAfter(list("a", "b", "c"), "a")).toBe(1);
    expect(insertPositionAfter(list("a", "b", "c"), "c")).toBe(3);
  });

  it("treats null as the very start", () => {
    expect(insertPositionAfter(list("a", "b"), null)).toBe(0);
  });

  /** Appending is a safer failure than silently inserting at the top. */
  it("appends when the anchor is unknown", () => {
    expect(insertPositionAfter(list("a", "b"), "zz")).toBe(2);
  });

  it("handles an empty list", () => {
    expect(insertPositionAfter([], null)).toBe(0);
    expect(insertPositionAfter([], "a")).toBe(0);
  });
});

describe("shiftForInsert", () => {
  it("pushes everything at or below the insertion point down", () => {
    expect(shiftForInsert(list("a", "b", "c"), 1, 1)).toEqual([
      { id: "b", position: 2 },
      { id: "c", position: 3 },
    ]);
  });

  it("shifts by the number of inserted items", () => {
    expect(shiftForInsert(list("a", "b"), 0, 3)).toEqual([
      { id: "a", position: 3 },
      { id: "b", position: 4 },
    ]);
  });

  it("returns nothing when appending past the end", () => {
    expect(shiftForInsert(list("a", "b"), 2, 1)).toEqual([]);
  });

  it("returns nothing for a zero-count insert", () => {
    expect(shiftForInsert(list("a", "b"), 0, 0)).toEqual([]);
  });

  /** The shifted range must never collide with the new rows' positions. */
  it("leaves exactly the inserted slots free", () => {
    const at = 1;
    const count = 2;
    const shifted = shiftForInsert(list("a", "b", "c"), at, count);
    const newSlots = [at, at + 1];
    expect(shifted.every((u) => !newSlots.includes(u.position))).toBe(true);
  });
});

describe("canReorder", () => {
  /**
   * Dropping "below this row" is meaningless when the rows in between are
   * filtered out, so dragging is disabled rather than applying an invisible
   * order.
   */
  it("is false while the list is filtered", () => {
    expect(canReorder({ filtered: true })).toBe(false);
    expect(canReorder({ filtered: false, sorted: true })).toBe(false);
    expect(canReorder({ filtered: false })).toBe(true);
  });
});
