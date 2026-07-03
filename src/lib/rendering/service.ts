import path from "node:path";

import { createRenderJob } from "@/lib/video/render";
import type { CaptionSegment, CaptionStyle, RenderJob } from "@/lib/video/types";
import { getRemotionBundle } from "./bundle";
import { getRender, registerRender, updateRender } from "./registry";
import { renderCaptionedVideo } from "./renderer";

/**
 * Export orchestration: staged MP4 + segments + style in, downloadable MP4
 * out, with polled progress. Routes call this; Remotion and the registry
 * stay behind it.
 */

export interface StartRenderInput {
  /** Staged source video; must live inside tempDir. */
  videoPath: string;
  /** Directory owning all files of this render; reclaimed by the registry TTL. */
  tempDir: string;
  segments: CaptionSegment[];
  style: CaptionStyle;
}

/**
 * Renders run strictly one at a time — Remotion saturates the machine, and
 * interleaved renders would slow every export. Callers see status "queued"
 * until their turn starts.
 */
let renderChain: Promise<void> = Promise.resolve();

export function startRender(input: StartRenderInput): RenderJob {
  const job = createRenderJob(
    path.basename(input.videoPath, ".mp4"),
    input.segments,
    input.style
  );
  const outputPath = path.join(input.tempDir, `${job.id}.mp4`);
  registerRender(job, input.tempDir);

  renderChain = renderChain.then(() => runRender(job.id, input, outputPath));
  return { ...job };
}

async function runRender(
  jobId: string,
  input: StartRenderInput,
  outputPath: string
): Promise<void> {
  // The job may have expired from the registry while queued.
  if (!getRender(jobId)) return;
  updateRender(jobId, { status: "rendering", progress: 0 });

  try {
    const serveUrl = await getRemotionBundle();
    await renderCaptionedVideo({
      videoPath: input.videoPath,
      segments: input.segments,
      style: input.style,
      outputPath,
      serveUrl,
      onProgress: (progress) => updateRender(jobId, { progress }),
    });
    updateRender(jobId, { status: "completed", progress: 100, outputPath });
  } catch (error) {
    console.error(`[render] job ${jobId} failed:`, error);
    updateRender(jobId, {
      status: "failed",
      error: "Rendering failed. Please try exporting again.",
    });
  }
}
