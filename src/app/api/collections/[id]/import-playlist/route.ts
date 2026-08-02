import { importItems } from "@/server/services/collection.service";
import { fetchPlaylist, isYouTubeConfigured } from "@/server/services/youtube.service";
import { dedupeKeyFor } from "@/core/domain/collection";
import { ApiError, parseBody, withAuth } from "@/server/http/handler";
import { importPlaylistSchema } from "@/server/validation/collection.schema";

/**
 * POST /api/collections/[id]/import-playlist
 *
 * Pulls video metadata from the YouTube Data API and appends it to the list.
 * Only titles, ids and durations are stored — playback happens later through
 * YouTube's own embedded player.
 */
export const POST = withAuth<{ id: string }>(async ({ userId, request, params }) => {
  if (!isYouTubeConfigured()) {
    throw ApiError.badRequest(
      "YouTube import is not configured — set YOUTUBE_API_KEY on the server"
    );
  }

  const { url } = await parseBody(request, importPlaylistSchema);
  const playlist = await fetchPlaylist(url);

  const result = await importItems(userId, params.id, {
    items: playlist.videos.map((video) => ({
      title: video.title,
      url: video.url,
      kind: "video" as const,
      externalId: video.videoId,
      dedupeKey: dedupeKeyFor({ externalId: video.videoId }),
      durationSeconds: video.durationSeconds,
      position: video.position,
    })),
  });

  return { ...result, playlistId: playlist.playlistId, truncated: playlist.truncated };
});
