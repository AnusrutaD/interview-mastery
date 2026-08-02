import "server-only";
import { parseIsoDuration } from "@/core/domain/watch";
import { ApiError } from "../http/handler";

/**
 * YouTube playlist import via the official Data API v3.
 *
 * Fetches *metadata only* — video ids, titles and durations. Playback happens
 * later through YouTube's own IFrame player, so the video is never copied,
 * hosted or proxied. That is both the correct architecture and what keeps this
 * squarely inside YouTube's terms.
 *
 * Requires a `YOUTUBE_API_KEY` (free, from Google Cloud Console → YouTube Data
 * API v3). Absent one, playlist import is unavailable and the UI says so rather
 * than failing obscurely.
 */

const API = "https://www.googleapis.com/youtube/v3";
/** The API's hard cap per page. */
const PAGE_SIZE = 50;
/** Sanity bound — a 2,000-video playlist is a mistake, not a study plan. */
const MAX_VIDEOS = 500;

export interface YouTubeVideo {
  videoId: string;
  title: string;
  position: number;
  durationSeconds: number | null;
  url: string;
}

export interface PlaylistImport {
  playlistId: string;
  title: string | null;
  videos: YouTubeVideo[];
  /** True when the playlist was longer than we are willing to import. */
  truncated: boolean;
}

export function isYouTubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/**
 * Pull a playlist id out of any of the URL shapes people paste, or accept a
 * bare id. Returns null rather than guessing.
 */
export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare id: starts with PL/UU/LL/FL/OL and is otherwise url-safe.
  if (/^(PL|UU|LL|FL|OL)[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!url.host.toLowerCase().replace(/^www\./, "").endsWith("youtube.com")) return null;
    const list = url.searchParams.get("list");
    return list && list.length > 5 ? list : null;
  } catch {
    return null;
  }
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      position?: number;
      resourceId?: { videoId?: string };
    };
  }>;
}

interface VideosResponse {
  items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw ApiError.badRequest("YouTube import is not configured on this server");

  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    const message = body?.error?.message ?? `YouTube API error ${response.status}`;

    // Translate the failures a user can actually act on.
    if (response.status === 404) throw ApiError.notFound("Playlist not found");
    if (response.status === 403) {
      throw ApiError.badRequest(
        "YouTube rejected the request — the playlist may be private, or the API quota is exhausted"
      );
    }
    throw ApiError.badRequest(message);
  }

  return (await response.json()) as T;
}

/** Durations come from a separate endpoint, batched 50 ids at a time. */
async function fetchDurations(videoIds: string[]): Promise<Map<string, number | null>> {
  const durations = new Map<string, number | null>();

  for (let i = 0; i < videoIds.length; i += PAGE_SIZE) {
    const batch = videoIds.slice(i, i + PAGE_SIZE);
    const data = await call<VideosResponse>("videos", {
      part: "contentDetails",
      id: batch.join(","),
      maxResults: String(PAGE_SIZE),
    });

    for (const item of data.items ?? []) {
      if (item.id) durations.set(item.id, parseIsoDuration(item.contentDetails?.duration));
    }
  }

  return durations;
}

export async function fetchPlaylist(playlistUrlOrId: string): Promise<PlaylistImport> {
  const playlistId = extractPlaylistId(playlistUrlOrId);
  if (!playlistId) {
    throw ApiError.badRequest("That does not look like a YouTube playlist link");
  }

  const collected: Array<{ videoId: string; title: string; position: number }> = [];
  let pageToken: string | undefined;
  let truncated = false;

  do {
    const data = await call<PlaylistItemsResponse>("playlistItems", {
      part: "snippet",
      playlistId,
      maxResults: String(PAGE_SIZE),
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title;
      if (!videoId || !title) continue;

      // Deleted and private entries survive in playlists as placeholder titles
      // with no usable video. Importing them would create items that can never
      // be watched or completed.
      if (title === "Deleted video" || title === "Private video") continue;

      collected.push({ videoId, title, position: item.snippet?.position ?? collected.length });
    }

    pageToken = data.nextPageToken;

    if (collected.length >= MAX_VIDEOS) {
      truncated = true;
      break;
    }
  } while (pageToken);

  if (collected.length === 0) {
    throw ApiError.badRequest("That playlist has no importable videos");
  }

  const durations = await fetchDurations(collected.map((v) => v.videoId));

  return {
    playlistId,
    title: null,
    truncated,
    videos: collected
      .sort((a, b) => a.position - b.position)
      .map((video) => ({
        videoId: video.videoId,
        title: video.title,
        position: video.position,
        durationSeconds: durations.get(video.videoId) ?? null,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
      })),
  };
}

/** Playlist title, for naming a newly created collection. */
export async function fetchPlaylistTitle(playlistId: string): Promise<string | null> {
  const data = await call<{ items?: Array<{ snippet?: { title?: string } }> }>("playlists", {
    part: "snippet",
    id: playlistId,
    maxResults: "1",
  });
  return data.items?.[0]?.snippet?.title ?? null;
}
