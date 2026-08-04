import { importItems } from "@/server/services/collection.service";
import { fetchPlaylist, isYouTubeConfigured } from "@/server/services/youtube.service";
import { dedupeKeyFor } from "@/core/domain/collection";
import { findPlaylistUrl, parseItemList, type ImportIssue, type ParsedItem } from "@/core/domain/itemImport";
import { ApiError, parseBody, withAuth } from "@/server/http/handler";
import {
  importItemsSchema,
  importTextSchema,
  MAX_IMPORT_ITEMS,
} from "@/server/validation/collection.schema";

type Params = { id: string };

/**
 * Expand any YouTube playlist links in a paste into their individual videos.
 *
 * The parser deliberately refuses playlist links, because importing one as a
 * single opaque item produces a row that just links back out to YouTube — which
 * reads, correctly, as "it didn't fetch the videos". Rather than making that the
 * user's problem to notice and correct, the server does the obvious thing:
 * pasting a playlist link simply imports the playlist.
 *
 * When the API key is absent the link becomes a legible issue instead of a
 * silent no-op.
 */
async function expandPlaylists(
  text: string,
  startPosition: number
): Promise<{ items: ParsedItem[]; issues: ImportIssue[] }> {
  const items: ParsedItem[] = [];
  const issues: ImportIssue[] = [];
  let position = startPosition;

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const playlistUrl = findPlaylistUrl(line);
    if (!playlistUrl) continue;

    if (!isYouTubeConfigured()) {
      issues.push({
        line: index + 1,
        text: line.trim(),
        reason: "Playlist link found, but YouTube import is not configured on this server",
      });
      continue;
    }

    try {
      const playlist = await fetchPlaylist(playlistUrl);
      for (const video of playlist.videos) {
        items.push({
          title: video.title,
          url: video.url,
          kind: "video",
          externalId: video.videoId,
          dedupeKey: dedupeKeyFor({ externalId: video.videoId }),
          difficulty: null,
          topic: null,
          durationSeconds: video.durationSeconds,
          position: position++,
        });
      }
    } catch (error) {
      issues.push({
        line: index + 1,
        text: line.trim(),
        reason: error instanceof ApiError ? error.message : "Could not read that playlist",
      });
    }
  }

  return { items, issues };
}

/**
 * POST /api/collections/[id]/items
 *
 * Accepts either a parsed `items` array or a raw `text` paste. Parsing the raw
 * form server-side means the client and the API can never disagree about what
 * a given paste produces.
 */
export const POST = withAuth<Params>(async ({ userId, request, params }) => {
  const body: unknown = await request.json().catch(() => null);

  if (body && typeof body === "object" && "text" in body) {
    const { text, insertAfter } = importTextSchema.parse(body);
    const parsed = parseItemList(text);

    const expanded = await expandPlaylists(text, parsed.items.length);
    // Drop the parser's "use the Playlist tab" advice — we just did it for them.
    const carried = parsed.issues.filter((issue) => !/playlist link/i.test(issue.reason));

    const allItems = [...parsed.items, ...expanded.items];
    const allIssues = [...carried, ...expanded.issues];

    if (allItems.length === 0) {
      throw ApiError.badRequest("Nothing importable found", { issues: allIssues });
    }
    if (allItems.length > MAX_IMPORT_ITEMS) {
      throw ApiError.badRequest(`Too many items — the limit is ${MAX_IMPORT_ITEMS} per import`);
    }

    const result = await importItems(userId, params.id, { items: allItems, insertAfter });
    return {
      ...result,
      issues: allIssues,
      duplicatesInPaste: parsed.duplicates,
      playlistsExpanded: expanded.items.length,
    };
  }

  const input = importItemsSchema.parse(body);
  return {
    ...(await importItems(userId, params.id, input)),
    issues: [],
    duplicatesInPaste: 0,
    playlistsExpanded: 0,
  };
});
