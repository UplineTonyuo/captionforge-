/**
 * Static options for @remotion/renderer's renderMedia. Kept in its own module
 * (no @remotion import) so the values are unit-testable without loading the
 * renderer, and so the memory-critical settings are explicit and pinned.
 *
 * `concurrency: 1` renders one frame at a time — a single Chromium tab — which
 * bounds peak render memory. Production evidence: Railway crashed with
 * "Error: Page crashed!" from @remotion/renderer as container memory climbed
 * from ~100 MB idle to ~900 MB during export, then dropped when the page died
 * (an OOM). Remotion's default concurrency is CPU-based and opens several tabs,
 * multiplying peak memory. Concurrency only affects parallelism, not output, so
 * the exported frames are byte-for-byte the same (WYSIWYG preserved).
 *
 * The codec/quality fields are unchanged from the original inline render call.
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
