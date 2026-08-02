import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dailyTargetProgress,
  dedupeKeyFor,
  EMPTY_ITEM_RECORD,
  joinItems,
  normaliseUrl,
  suggestNextItem,
  summarizeCollection,
  toCollectionSource,
  toItemKind,
  type Collection,
  type Item,
  type ItemProgressMap,
} from "./collection";

const NOW = new Date("2026-07-28T04:30:00.000Z"); // 10:00 IST

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function item(over: Partial<Item> & { id: string }): Item {
  return {
    collectionId: "c1",
    title: `Item ${over.id}`,
    url: null,
    kind: "problem",
    externalId: null,
    difficulty: null,
    topic: null,
    tags: [],
    position: 0,
    metadata: null,
    ...over,
  };
}

function record(over: Partial<typeof EMPTY_ITEM_RECORD> = {}) {
  return { ...EMPTY_ITEM_RECORD, ...over };
}

const collection = (over: Partial<Collection> = {}): Collection => ({
  id: "c1",
  name: "Test",
  description: null,
  source: "manual",
  sourceUrl: null,
  templateKey: null,
  dailyTarget: null,
  weeklyTarget: null,
  position: 0,
  icon: null,
  archived: false,
  ...over,
});

describe("joinItems", () => {
  it("fills untouched items with the empty record", () => {
    const joined = joinItems([item({ id: "a" })], {});
    expect(joined[0]).toMatchObject({ id: "a", mastery: "unseen", due: false });
  });

  it("computes due state from lastPracticedAt", () => {
    const progress: ItemProgressMap = {
      a: record({ mastery: "learning", lastPracticedAt: "2026-07-26T10:00:00.000Z" }),
    };
    expect(joinItems([item({ id: "a" })], progress)[0].due).toBe(true);
  });

  it("is not due when practised today", () => {
    const progress: ItemProgressMap = {
      a: record({ mastery: "learning", lastPracticedAt: NOW.toISOString() }),
    };
    expect(joinItems([item({ id: "a" })], progress)[0].due).toBe(false);
  });
});

describe("summarizeCollection", () => {
  it("reports zeroes for an untouched collection", () => {
    const stats = summarizeCollection(joinItems([item({ id: "a" }), item({ id: "b" })], {}));
    expect(stats).toMatchObject({ total: 2, attempted: 0, completed: 0, completionPercent: 0 });
  });

  it("separates attempted from completed", () => {
    const progress: ItemProgressMap = {
      a: record({ mastery: "unsolved", lastPracticedAt: NOW.toISOString() }),
      b: record({ mastery: "familiar", lastPracticedAt: NOW.toISOString() }),
    };
    const stats = summarizeCollection(
      joinItems([item({ id: "a" }), item({ id: "b" })], progress)
    );
    expect(stats.attempted).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.unsolved).toBe(1);
  });

  // Same rule as the DSA track: a failed attempt is practice, not a completion.
  it("excludes unsolved from completedToday", () => {
    const progress: ItemProgressMap = {
      a: record({ mastery: "unsolved", lastPracticedAt: NOW.toISOString() }),
      b: record({ mastery: "learning", lastPracticedAt: NOW.toISOString() }),
    };
    const stats = summarizeCollection(
      joinItems([item({ id: "a" }), item({ id: "b" })], progress)
    );
    expect(stats.completedToday).toBe(1);
  });

  it("counts items by kind", () => {
    const stats = summarizeCollection(
      joinItems([item({ id: "a", kind: "video" }), item({ id: "b", kind: "problem" })], {})
    );
    expect(stats.byKind).toMatchObject({ video: 1, problem: 1, article: 0 });
  });
});

describe("dailyTargetProgress", () => {
  const stats = (completedToday: number) => ({ completedToday });

  it("is null when the collection has no target", () => {
    expect(dailyTargetProgress(collection({ dailyTarget: null }), stats(3))).toBeNull();
  });

  /**
   * A null target means the user opted out of pacing this list. That must not
   * render as "target met" — which is what a naive `done >= target` on 0 does.
   */
  it("treats a zero target as no target, not as already met", () => {
    expect(dailyTargetProgress(collection({ dailyTarget: 0 }), stats(0))).toBeNull();
  });

  it("reports progress toward a real target", () => {
    expect(dailyTargetProgress(collection({ dailyTarget: 4 }), stats(1))).toMatchObject({
      target: 4,
      done: 1,
      percent: 25,
      met: false,
    });
  });

  it("caps the percentage at 100 when the target is beaten", () => {
    expect(dailyTargetProgress(collection({ dailyTarget: 2 }), stats(5))).toMatchObject({
      percent: 100,
      met: true,
    });
  });
});

describe("suggestNextItem", () => {
  it("returns null for an empty collection", () => {
    expect(suggestNextItem([])).toBeNull();
  });

  it("prefers due items over untouched ones", () => {
    const progress: ItemProgressMap = {
      b: record({ mastery: "learning", lastPracticedAt: "2026-07-01T10:00:00.000Z" }),
    };
    const joined = joinItems(
      [item({ id: "a", position: 0 }), item({ id: "b", position: 1 })],
      progress
    );
    expect(suggestNextItem(joined)?.id).toBe("b");
  });

  it("puts unsolved ahead of other due items", () => {
    const old = "2026-06-01T10:00:00.000Z";
    const progress: ItemProgressMap = {
      a: record({ mastery: "mastered", lastPracticedAt: old }),
      b: record({ mastery: "unsolved", lastPracticedAt: old }),
    };
    const joined = joinItems([item({ id: "a" }), item({ id: "b" })], progress);
    expect(suggestNextItem(joined)?.id).toBe("b");
  });

  /**
   * Imported lists often carry no difficulty at all, but they always carry the
   * order the author intended — so sequence, not difficulty, breaks ties.
   */
  it("falls back to the earliest untouched item by position", () => {
    const joined = joinItems(
      [item({ id: "late", position: 5 }), item({ id: "early", position: 1 })],
      {}
    );
    expect(suggestNextItem(joined)?.id).toBe("early");
  });

  it("returns null once everything is done and nothing is due", () => {
    const progress: ItemProgressMap = {
      a: record({ mastery: "mastered", lastPracticedAt: NOW.toISOString() }),
    };
    expect(suggestNextItem(joinItems([item({ id: "a" })], progress))).toBeNull();
  });
});

describe("normaliseUrl", () => {
  it("strips scheme, www and trailing slash", () => {
    expect(normaliseUrl("https://www.leetcode.com/problems/two-sum/")).toBe(
      "leetcode.com/problems/two-sum"
    );
  });

  it("treats http and https as the same resource", () => {
    expect(normaliseUrl("http://leetcode.com/problems/two-sum")).toBe(
      normaliseUrl("https://www.leetcode.com/problems/two-sum/")
    );
  });

  it("drops tracking parameters but keeps meaningful ones", () => {
    expect(normaliseUrl("https://youtube.com/watch?v=abc123&utm_source=x&si=y")).toBe(
      "youtube.com/watch?v=abc123"
    );
  });

  it("sorts query parameters so order does not create a false difference", () => {
    expect(normaliseUrl("https://e.com/x?b=2&a=1")).toBe(normaliseUrl("https://e.com/x?a=1&b=2"));
  });

  it("accepts a bare host without a scheme", () => {
    expect(normaliseUrl("leetcode.com/problems/two-sum")).toBe("leetcode.com/problems/two-sum");
  });

  it("returns null for unparseable input", () => {
    expect(normaliseUrl("")).toBeNull();
    expect(normaliseUrl("   ")).toBeNull();
  });
});

describe("dedupeKeyFor", () => {
  it("prefers the external id", () => {
    expect(dedupeKeyFor({ externalId: "two-sum", url: "https://x.com/y" })).toBe("two-sum");
  });

  it("falls back to the normalised url", () => {
    expect(dedupeKeyFor({ url: "https://www.leetcode.com/problems/two-sum/" })).toBe(
      "leetcode.com/problems/two-sum"
    );
  });

  /**
   * Null is meaningful: Postgres permits repeated NULLs in a unique index, so
   * hand-entered items with neither id nor link never collide with each other.
   */
  it("is null when there is nothing stable to key on", () => {
    expect(dedupeKeyFor({})).toBeNull();
    expect(dedupeKeyFor({ externalId: "  " })).toBeNull();
  });
});

describe("narrowing untrusted values", () => {
  it("falls back for unknown kinds and sources", () => {
    expect(toItemKind("video")).toBe("video");
    expect(toItemKind("podcast")).toBe("other");
    expect(toCollectionSource("youtube")).toBe("youtube");
    expect(toCollectionSource(null)).toBe("manual");
  });
});
