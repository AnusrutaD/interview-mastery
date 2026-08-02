import "server-only";

/**
 * Minimal YAML frontmatter parser.
 *
 * Deliberately not a YAML library: content is authored in this repo by one
 * person, the shape is fixed, and pulling in a full parser (plus MDX tooling)
 * to read a dozen static files is not a trade worth making. Supports exactly
 * what the content format uses — scalars, nested maps, and lists of maps.
 *
 * If the content format ever needs anchors, multi-line folding or type tags,
 * that is the signal to adopt `gray-matter` rather than extend this.
 */

export interface ParsedDocument {
  data: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseDocument(raw: string): ParsedDocument {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: raw.trim() };
  return { data: parseBlock(match[1]), body: match[2].trim() };
}

interface Line {
  indent: number;
  text: string;
}

function toLines(source: string): Line[] {
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !/^\s*#/.test(line))
    .map((line) => ({ indent: line.match(/^\s*/)![0].length, text: line.trim() }));
}

function parseBlock(source: string): Record<string, unknown> {
  return buildMap(toLines(source), 0);
}

/** Consume every line at `indent` (and their children) into an object. */
function buildMap(lines: Line[], indent: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      index += 1;
      continue;
    }

    const separator = line.text.indexOf(":");
    if (separator === -1) {
      index += 1;
      continue;
    }

    const key = line.text.slice(0, separator).trim();
    const inline = line.text.slice(separator + 1).trim();
    const children = collectChildren(lines, index + 1, line.indent);

    if (inline !== "") {
      result[key] = parseScalar(inline);
    } else if (children.length > 0) {
      result[key] = children[0].text.startsWith("- ")
        ? buildList(children)
        : buildMap(children, children[0].indent);
    } else {
      result[key] = null;
    }

    index += 1 + children.length;
  }

  return result;
}

function collectChildren(lines: Line[], start: number, parentIndent: number): Line[] {
  const children: Line[] = [];
  for (let i = start; i < lines.length && lines[i].indent > parentIndent; i += 1) {
    children.push(lines[i]);
  }
  return children;
}

/** A list whose items are either scalars or maps. */
function buildList(lines: Line[]): unknown[] {
  const items: unknown[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.text.startsWith("- ")) {
      index += 1;
      continue;
    }

    const head = line.text.slice(2).trim();
    // Lines belonging to this item: deeper indent, or same indent without "- ".
    const owned: Line[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const candidate = lines[cursor];
      const isSibling = candidate.indent === line.indent && candidate.text.startsWith("- ");
      if (isSibling || candidate.indent < line.indent) break;
      owned.push(candidate);
      cursor += 1;
    }

    if (head.includes(":") && !head.startsWith("[")) {
      // Map item — fold the inline "key: value" back in as a child line.
      const inner = [{ indent: line.indent + 2, text: head }, ...owned];
      items.push(buildMap(inner, line.indent + 2));
    } else {
      items.push(parseScalar(head));
    }

    index = cursor;
  }

  return items;
}

function parseScalar(raw: string): unknown {
  const value = raw.trim();

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return splitTopLevel(inner).map((part) => parseScalar(part));
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);

  return value;
}

/** Split on commas that are not inside quotes or brackets. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";

  for (const char of input) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}
