"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeWatch,
  recordTick,
  type WatchState,
} from "@/core/domain/watch";
import { formatClock } from "@/core/time/format";
import { cn } from "@/lib/cn";

/**
 * In-app video playback with honest watch tracking.
 *
 * Uses YouTube's official IFrame Player API — the video is streamed by YouTube,
 * with their ads and view counting intact. Nothing is proxied or stored here;
 * we only observe playback position to record how much was genuinely watched.
 *
 * Position is sampled on an interval and folded through `recordTick`, which
 * credits plausible playback deltas and ignores seeks. Dragging the scrubber to
 * the end therefore does not mark a video complete.
 */

const SAMPLE_MS = 5_000;
/** How often progress reaches the server. Cheap enough to be frequent. */
const SAVE_MS = 15_000;
const IFRAME_API = "https://www.youtube.com/iframe_api";

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, options: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Load the IFrame API once per page, shared across every player instance. */
let apiPromise: Promise<void> | null = null;
function loadIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = IFRAME_API;
    document.head.appendChild(script);
  });

  return apiPromise;
}

export interface VideoPlayerProps {
  videoId: string;
  title: string;
  durationSeconds: number | null;
  initialWatchedSeconds: number;
  initialPositionSeconds: number;
  onProgress: (state: WatchState) => Promise<void> | void;
  onComplete?: () => void;
}

export function VideoPlayer({
  videoId,
  title,
  durationSeconds,
  initialWatchedSeconds,
  initialPositionSeconds,
  onProgress,
  onComplete,
}: VideoPlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastPositionRef = useRef(initialPositionSeconds);
  const lastSavedRef = useRef(0);
  const completedRef = useRef(false);

  // Authoritative watch state lives in a ref so the sampling interval never
  // reads a stale closure — the same defect that broke the solve timer.
  const stateRef = useRef<WatchState>({
    watchedSeconds: initialWatchedSeconds,
    positionSeconds: initialPositionSeconds,
  });

  const [display, setDisplay] = useState<WatchState>(stateRef.current);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Effective duration: prefer what the player reports, fall back to metadata.
  const [liveDuration, setLiveDuration] = useState<number | null>(durationSeconds);
  const progress = describeWatch(display, liveDuration);

  const save = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastSavedRef.current < SAVE_MS) return;
      lastSavedRef.current = now;
      void onProgress({
        watchedSeconds: Math.floor(stateRef.current.watchedSeconds),
        positionSeconds: Math.floor(stateRef.current.positionSeconds),
      });
    },
    [onProgress]
  );

  useEffect(() => {
    let cancelled = false;

    void loadIframeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId,
        playerVars: {
          // Resume where they left off, minus a couple of seconds for context.
          start: Math.max(0, Math.floor(initialPositionSeconds) - 2),
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            if (cancelled) return;
            setReady(true);
            const reported = event.target.getDuration();
            if (reported > 0) setLiveDuration(Math.floor(reported));
          },
          onStateChange: (event: { data: number }) => {
            if (cancelled || !window.YT) return;
            const state = event.data;
            setPlaying(state === window.YT.PlayerState.PLAYING);
            // Persist on pause and on end rather than waiting for the throttle.
            if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) {
              save(true);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      save(true);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // Re-creating the player on every prop change would interrupt playback;
    // videoId is the only identity that should rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Sampling loop — only while genuinely playing.
  useEffect(() => {
    if (!ready || !playing) return;

    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const current = player.getCurrentTime();
      const before = stateRef.current;
      const next = recordTick(before, {
        previousPosition: lastPositionRef.current,
        currentPosition: current,
      });

      lastPositionRef.current = current;
      stateRef.current = next;
      setDisplay(next);

      const duration = liveDuration;
      if (!completedRef.current && describeWatch(next, duration).complete) {
        completedRef.current = true;
        save(true);
        onComplete?.();
      } else {
        save();
      }
    }, SAMPLE_MS);

    return () => window.clearInterval(id);
  }, [ready, playing, liveDuration, save, onComplete]);

  // Flush on tab close so a session is not lost.
  useEffect(() => {
    const flush = () => save(true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, [save]);

  return (
    <div>
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1.5 gap-3">
          <span className="text-gray-500 dark:text-gray-400 truncate">{title}</span>
          <span
            className={cn(
              "font-semibold tabular-nums shrink-0",
              progress.complete
                ? "text-green-600 dark:text-green-400"
                : "text-gray-600 dark:text-gray-300"
            )}
          >
            {progress.complete ? "✓ Watched" : `${progress.percent}%`}
          </span>
        </div>

        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progress.complete ? "bg-green-500" : "bg-red-500"
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5">
          {liveDuration ? (
            <>
              Watched {formatClock(Math.min(display.watchedSeconds, liveDuration))} of{" "}
              {formatClock(liveDuration)}
              {!progress.complete && progress.remainingSeconds > 0 && (
                <> · {formatClock(progress.remainingSeconds)} more to complete</>
              )}
            </>
          ) : (
            "Duration unknown — progress cannot be tracked for this video"
          )}
        </p>

        {/* Says out loud what the tracking does, so the number is trusted. */}
        <p className="text-[10px] text-gray-300 dark:text-gray-700 mt-1">
          Only actual playback counts — skipping ahead will not mark this complete.
        </p>
      </div>
    </div>
  );
}
