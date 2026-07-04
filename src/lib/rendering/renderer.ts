import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { renderMedia, selectComposition } from "@remotion/renderer";

import { probeMedia } from "@/lib/video/probe";
import type { CaptionSegment, CaptionStyle } from "@/lib/video/types";
import { resolveBrowserExecutable } from "./browser";

/**
 * Remotion render adapter: burns the CaptionedVideo composition into an MP4.
 * This is the server-side half of the WYSIWYG guarantee — it renders the
 * exact same composition (and therefore the same CaptionRenderer component)
 * the preview Player shows, at the source video's resolution and frame rate.
 *
 * The only module allowed to call @remotion/renderer.
 */

export interface RenderInput {
  /** Absolute path to the staged source MP4. */
  videoPath: string;
  segments: CaptionSegment[];
  style: CaptionStyle;
  /** Absolute path the finished MP4 is written to. */
  outputPath: string;
  serveUrl: string;
  onProgress: (progressPct: number) => void;
}

const COMPOSITION_ID = "CaptionedVideo";

/**
 * Remotion needs a browser to paint React frames. We prefer an explicit
 * CAPTIONFORGE_BROWSER_EXECUTABLE, then an auto-detected system Chrome/Edge,
 * and only as a last resort let Remotion download its own headless shell
 * (which needs network and fails behind firewalls). Resolution logic lives in
 * ./browser so it is unit tested; here we just log which browser was chosen.
 */
function browserOptions(): {
  browserExecutable: string | null;
  chromeMode: "headless-shell" | "chrome-for-testing";
} {
  const { browserExecutable, chromeMode, source } = resolveBrowserExecutable();
  if (source === "download") {
    console.warn(
      "[render] no CAPTIONFORGE_BROWSER_EXECUTABLE and no system Chrome/Edge " +
        "found; Remotion will try to download a headless shell (needs network)."
    );
  } else {
    console.info(`[render] using ${source} browser: ${browserExecutable}`);
  }
  return { browserExecutable, chromeMode };
}

export async function renderCaptionedVideo({
  videoPath,
  segments,
  style,
  outputPath,
  serveUrl,
  onProgress,
}: RenderInput): Promise<void> {
  const media = await probeMedia(videoPath);

  // Stage the input inside the bundle's public dir so OffthreadVideo can
  // resolve it through staticFile() during the render.
  const inputName = `render-inputs/${path.basename(
    outputPath,
    ".mp4"
  )}-source.mp4`;
  const stagedPath = path.join(serveUrl, "public", inputName);
  await mkdir(path.dirname(stagedPath), { recursive: true });
  await copyFile(videoPath, stagedPath);

  const inputProps = {
    videoSrc: inputName,
    segments,
    captionStyle: style,
    loopCaptions: false,
  };

  try {
    const browser = browserOptions();
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
      ...browser,
    });

    const fps = media.frameRate ?? composition.fps;
    await renderMedia({
      composition: {
        ...composition,
        width: media.width ?? composition.width,
        height: media.height ?? composition.height,
        fps,
        durationInFrames: Math.max(
          1,
          Math.round(media.durationSeconds * fps)
        ),
      },
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      ...browser,
      // Quality over speed: exports are re-encodes of the user's footage, so
      // keep the intermediate frames lossless-ish and the encode near-source.
      jpegQuality: 100,
      crf: 16,
      audioBitrate: "320k",
      onProgress: ({ progress }) => onProgress(Math.round(progress * 100)),
    });
  } finally {
    await rm(stagedPath, { force: true });
  }
}
