/**
 * Static + derived options for @remotion/renderer's renderMedia. Kept in its own
 * module (no @remotion import) so the memory-critical settings are explicit,
 * pinned, and unit-testable without loading the renderer.
 *
 * `concurrency: 1` renders one frame/tab at a time (bounds Chromium tabs).
 *
 * `offthreadVideoCacheSizeInBytes` caps Remotion's <OffthreadVideo> frame cache.
 * Proven from the installed Remotion 4.0.484 source
 * (options/offthreadvideo-cache-size.js): the default is `null` =
 * "half of the system memory available when the render starts", passed to the
 * compositor as `maximum_frame_cache_size_in_bytes`
 * (offthread-video-server.js). In a ~1 GB Railway container that default sizes
 * the cache far above the cgroup limit, so it grows across frames until the
 * container OOMs and the kernel kills the Chromium renderer ("Page crashed!"
 * mid-render). Capping it keeps peak memory under the limit. Evicted frames are
 * re-extracted, so the exported video is byte-for-byte identical — no change to
 * codec, CRF, resolution, fps, caption visuals, timing, fonts, or audio.
 *
 * Memory budget for a ~1 GB (1024 MB) container:
 *   Node/Next ~150 MB + Chromium (1 tab) ~300 MB + compositor base ~80 MB +
 *   ffmpeg/headroom ~150 MB ≈ 680 MB fixed, leaving ~340 MB. A 256 MB cap keeps
 *   the peak near ~850 MB, comfortably under 1 GB. Tunable at runtime via
 *   CAPTIONFORGE_OFFTHREAD_CACHE_MB (megabytes) without a code change.
 */

/** Lowest safe render concurrency: one frame/tab at a time (Railway OOM fix). */
export const RENDER_CONCURRENCY = 1;

export const RENDER_MEDIA_OPTIONS = {
  codec: "h264",
  jpegQuality: 100,
  crf: 16,
  audioBitrate: "320k",
  concurrency: RENDER_CONCURRENCY,
} as const;

/** Default OffthreadVideo frame-cache cap, in MB, for a ~1 GB container. */
export const DEFAULT_OFFTHREAD_CACHE_MB = 256;

/**
 * The explicit OffthreadVideo frame-cache size in bytes. Reads
 * CAPTIONFORGE_OFFTHREAD_CACHE_MB (positive number of MB) if set; otherwise the
 * conservative default. Always returns a positive integer (never null), so the
 * cache can never fall back to Remotion's "half of system memory" default.
 */
export function offthreadVideoCacheSizeInBytes(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): number {
  const raw = Number(env.CAPTIONFORGE_OFFTHREAD_CACHE_MB);
  const mb = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_OFFTHREAD_CACHE_MB;
  return Math.round(mb * 1024 * 1024);
}
