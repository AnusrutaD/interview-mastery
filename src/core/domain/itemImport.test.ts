import { describe, expect, it } from "vitest";
import { findPlaylistUrl, isPlaylistUrl, parseItemList } from "./itemImport";

/**
 * Regression: a pasted playlist link used to import as ONE item with no video
 * id, which rendered as a plain link straight back out to YouTube. The user
 * reasonably read that as "it didn't fetch the videos".
 */
describe("playlist links", () => {
  const PLAYLIST = "https://www.youtube.com/playlist?list=PLjTveVh7FakK3c6rb-1-_KO4k8r3--8CU";

  it("recognises a playlist url", () => {
    expect(isPlaylistUrl(PLAYLIST)).toBe(true);
  });

  it("recognises one without www", () => {
    expect(isPlaylistUrl("https://youtube.com/playlist?list=PLabc123456")).toBe(true);
  });

  /** A watch URL carrying `list` is a video within a playlist — importable as-is. */
  it("does not treat a watch link inside a playlist as a playlist", () => {
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=abc123&list=PLxyz")).toBe(false);
  });

  it("ignores non-YouTube urls and plain text", () => {
    expect(isPlaylistUrl("https://leetcode.com/problem-list/abc/")).toBe(false);
    expect(isPlaylistUrl("Design a rate limiter")).toBe(false);
  });

  it("refuses to import a playlist link as a single item", () => {
    const result = parseItemList(PLAYLIST);
    expect(result.items).toHaveLength(0);
    expect(result.issues[0].reason).toMatch(/playlist/i);
  });

  it("still imports the other lines around it", () => {
    const result = parseItemList(
      [PLAYLIST, "https://youtu.be/abc12345", "Design a chat system"].join("\n")
    );
    expect(result.items).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
  });

  it("finds the playlist url so the UI can offer to switch importers", () => {
    expect(findPlaylistUrl(`Some notes\n${PLAYLIST}\nmore`)).toBe(PLAYLIST);
  });

  it("returns null when there is no playlist link", () => {
    expect(findPlaylistUrl("https://youtu.be/abc12345\nTwo Sum")).toBeNull();
  });
});

describe("line formats", () => {
  it("accepts a bare URL and derives a readable title", () => {
    const { items } = parseItemList("https://leetcode.com/problems/two-sum/");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Two Sum",
      kind: "problem",
      externalId: "two-sum",
    });
  });

  it("accepts title, comma, URL", () => {
    const { items } = parseItemList("Valid Anagram, https://leetcode.com/problems/valid-anagram/");
    expect(items[0]).toMatchObject({ title: "Valid Anagram", externalId: "valid-anagram" });
  });

  it("accepts pipe-separated fields with a difficulty", () => {
    const { items } = parseItemList("3Sum | https://leetcode.com/problems/3sum/ | Medium");
    expect(items[0]).toMatchObject({ title: "3Sum", difficulty: "Medium" });
  });

  it("accepts tab-separated fields with a topic", () => {
    const { items } = parseItemList("Two Sum\thttps://leetcode.com/problems/two-sum/\tEasy\tArrays");
    expect(items[0]).toMatchObject({ title: "Two Sum", difficulty: "Easy", topic: "Arrays" });
  });

  it("accepts a title with no link at all", () => {
    const { items } = parseItemList("Reverse a linked list in place");
    expect(items[0]).toMatchObject({ title: "Reverse a linked list in place", url: null });
  });

  it("does not split a URL that contains commas in its query", () => {
    const { items } = parseItemList("https://example.com/x?a=1,2,3");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/x?a=1,2,3");
  });
});

describe("source recognition", () => {
  it("recognises YouTube watch links as videos", () => {
    const { items } = parseItemList("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(items[0]).toMatchObject({ kind: "video", externalId: "dQw4w9WgXcQ" });
  });

  it("recognises short youtu.be links", () => {
    const { items } = parseItemList("https://youtu.be/abc12345");
    expect(items[0]).toMatchObject({ kind: "video", externalId: "abc12345" });
  });

  it("treats unknown hosts as articles", () => {
    const { items } = parseItemList("https://example.com/some-post");
    expect(items[0].kind).toBe("article");
  });

  it("treats a title-only line as a problem", () => {
    const { items } = parseItemList("Design a rate limiter");
    expect(items[0].kind).toBe("problem");
  });
});

describe("robustness", () => {
  /**
   * The core promise of the parser: one bad line must never cost the user the
   * rest of the paste. Anything unusable is reported, everything else imports.
   */
  it("imports good lines and reports bad ones", () => {
    const result = parseItemList(
      ["https://leetcode.com/problems/two-sum/", "   ", "x".repeat(400)].join("\n")
    );
    expect(result.items).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toMatch(/too long/i);
  });

  it("reports the original line number so the user can find the problem", () => {
    const result = parseItemList(["good line", "y".repeat(400)].join("\n"));
    expect(result.issues[0].line).toBe(2);
  });

  it("skips blank lines and comments", () => {
    const { items } = parseItemList("# my list\n\nTwo Sum\n// later\n3Sum");
    expect(items.map((i) => i.title)).toEqual(["Two Sum", "3Sum"]);
  });

  it("skips a spreadsheet header row", () => {
    const { items } = parseItemList("Title,URL\nTwo Sum,https://leetcode.com/problems/two-sum/");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Two Sum");
  });

  it("handles Windows line endings", () => {
    const { items } = parseItemList("Two Sum\r\n3Sum");
    expect(items).toHaveLength(2);
  });

  it("returns an empty result for empty input rather than throwing", () => {
    expect(parseItemList("")).toMatchObject({ items: [], issues: [], duplicates: 0 });
  });
});

describe("de-duplication", () => {
  it("collapses the same URL written in different forms", () => {
    const result = parseItemList(
      [
        "https://leetcode.com/problems/two-sum/",
        "http://www.leetcode.com/problems/two-sum",
        "https://leetcode.com/problems/two-sum/?utm_source=newsletter",
      ].join("\n")
    );
    expect(result.items).toHaveLength(1);
    expect(result.duplicates).toBe(2);
  });

  it("keeps distinct problems apart", () => {
    const result = parseItemList(
      ["https://leetcode.com/problems/two-sum/", "https://leetcode.com/problems/3sum/"].join("\n")
    );
    expect(result.items).toHaveLength(2);
    expect(result.duplicates).toBe(0);
  });

  /**
   * Two hand-typed titles have no stable identity, so they must not be treated
   * as duplicates of each other just because both dedupe keys are null.
   */
  it("does not collapse distinct title-only lines", () => {
    const result = parseItemList("Design a URL shortener\nDesign a chat system");
    expect(result.items).toHaveLength(2);
    expect(result.duplicates).toBe(0);
  });
});

describe("positions", () => {
  it("numbers items sequentially from zero", () => {
    const { items } = parseItemList("A\nB\nC");
    expect(items.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it("continues from an offset when appending to an existing collection", () => {
    const { items } = parseItemList("A\nB", 10);
    expect(items.map((i) => i.position)).toEqual([10, 11]);
  });

  it("does not leave gaps when lines are skipped", () => {
    const { items } = parseItemList("A\n\n# comment\nB");
    expect(items.map((i) => i.position)).toEqual([0, 1]);
  });
});
