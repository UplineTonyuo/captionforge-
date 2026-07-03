import { DEFAULT_CAPTION_STYLE } from "@/lib/captions/style";
import type { CaptionSegment, CaptionStyle, RenderJob } from "./types";

/**
 * Render job factory. The server-side pipeline that executes these jobs
 * (Remotion renderer, progress registry, export API) lives in
 * src/lib/rendering/; the visual source of truth is the CaptionRenderer
 * React component, rendered identically by the preview Player and the
 * export render.
 */

export { DEFAULT_CAPTION_STYLE };

export function createRenderJob(
  videoId: string,
  segments: CaptionSegment[] = [],
  style: CaptionStyle = DEFAULT_CAPTION_STYLE
): RenderJob {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    videoId,
    status: "queued",
    progress: 0,
    segments,
    style,
    createdAt: now,
    updatedAt: now,
  };
}

