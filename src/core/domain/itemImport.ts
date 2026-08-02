/**
 * Parsing pasted or uploaded lists into importable items.
 *
 * Import is the make-or-break of this product: if adding a list is fiddly,
 * nobody gets past the empty collection. So the parser is deliberately forgiving
 * — it accepts several shapes people actually have to hand, and never rejects a
 * whole paste because one line is malformed. Bad lines are reported back so the
 * user can fix them, while the good ones import.
 *
 * Accepted per line:
 *   https://leetcode.com/problems/two-sum/
 *   Two Sum, https://leetcode.com/problems/two-sum/
 *   Two Sum | https://leetcode.com/problems/two-sum/ | Easy
 *   Two Sum<TAB>https://...<TAB>Easy<TAB>Arrays
 *   Two Sum                                   (title only — no link)
 */
import { dedupeKeyFor, toItemKind, type ItemKind } from "./collection";

export interface ParsedItem {
  title: string;
  url: string | null;
  kind: ItemKind;
  externalId: string | null;
  dedupeKey: string | null;
  difficulty: string | null;
  topic: string | null;
  position: number;
}

export interface ImportIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ImportResult {
  items: ParsedItem[];
  issues: ImportIssue[];
  /** Lines dropped because an identical item already appeared in this paste. */
  duplicates: number;
}

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

/** Split on tab, pipe, or comma — whichever the line actually uses. */
function splitFields(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes("|")) return line.split("|");
  // Only treat a comma as a separator when it is not inside a URL.
  if (/,\s*https?:\/\//i.test(line) || !/https?:\/\//i.test(line)) return line.split(",");
  return [line];
}

const URL_RE = /https?:\/\/\S+/i;

/** Recognise the source from the host and pull a stable external id. */
function identify(url: string): { kind: ItemKind; externalId: string | null } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "other", externalId: null };
  }

  const host = parsed.host.toLowerCase().replace(/^www\./, "");

  if (host.endsWith("leetcode.com")) {
    const match = parsed.pathname.match(/\/problems\/([^/]+)/);
    return { kind: "problem", externalId: match ? match[1] : null };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    return { kind: "video", externalId: parsed.searchParams.get("v") };
  }
  if (host === "youtu.be") {
    return { kind: "video", externalId: parsed.pathname.slice(1) || null };
  }

  if (host.includes("geeksforgeeks.org")) {
    return { kind: "problem", externalId: null };
  }

  return { kind: "article", externalId: null };
}

/** Turn a URL into a readable title when the user gave none. */
function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    if (!segment) return parsed.host.replace(/^www\./, "");
    return segment
      .replace(/[-_]+/g, " ")
      .replace(/\.\w+$/, "")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return url;
  }
}

export function parseItemList(raw: string, startPosition = 0): ImportResult {
  const items: ParsedItem[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  const lines = raw.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    // Let people paste a spreadsheet export without stripping the header.
    if (index === 0 && /^(title|name|problem)\s*[,|\t]/i.test(line)) return;
    if (line.startsWith("#") || line.startsWith("//")) return;

    const fields = splitFields(line).map((f) => f.trim()).filter(Boolean);
    if (fields.length === 0) return;

    const urlField = fields.find((f) => URL_RE.test(f));
    const url = urlField ? (urlField.match(URL_RE)?.[0] ?? null) : null;

    const rest = fields.filter((f) => f !== urlField);
    const difficulty =
      rest.find((f) => DIFFICULTIES.has(f.toLowerCase()))?.toLowerCase() ?? null;

    const remaining = rest.filter((f) => f.toLowerCase() !== difficulty);
    let title = remaining[0] ?? "";
    const topic = remaining[1] ?? null;

    if (!title && url) title = titleFromUrl(url);

    if (!title) {
      issues.push({ line: index + 1, text: line, reason: "No title or link found" });
      return;
    }
    if (title.length > 300) {
      issues.push({ line: index + 1, text: line.slice(0, 60), reason: "Title too long" });
      return;
    }

    const { kind, externalId } = url ? identify(url) : { kind: "problem" as ItemKind, externalId: null };
    const dedupeKey = dedupeKeyFor({ externalId, url });

    // Within one paste, collapse repeats. Across imports the database unique
    // index on (collectionId, dedupeKey) does the same job.
    if (dedupeKey) {
      if (seen.has(dedupeKey)) {
        duplicates += 1;
        return;
      }
      seen.add(dedupeKey);
    }

    items.push({
      title,
      url,
      kind: toItemKind(kind),
      externalId,
      dedupeKey,
      difficulty: difficulty ? difficulty[0].toUpperCase() + difficulty.slice(1) : null,
      topic,
      position: startPosition + items.length,
    });
  });

  return { items, issues, duplicates };
}
