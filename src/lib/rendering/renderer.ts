import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

import { probeMedia } from "@/lib/video/probe";
import type { CaptionSegment, CaptionStyle } from "@/lib/video/types";
import { resolveBrowserExecutable } from "./browser";

/** Thrown when no usable Chromium can be provisioned for the render. */
export class BrowserUnavailableError extends Error {
  constructor(
    message = "No Chrome/Chromium browser is available for rendering. Install Chrome, or set CAPTIONFORGE_BROWSER_EXECUTABLE to its path."
  ) {
    super(message);
    this.name = "BrowserUnavailableError";
  }
}

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

/**
 * Explicitly provision the render browser up front, instead of relying on
 * Remotion's implicit, unmonitored download inside selectComposition/renderMedia.
 * ensureBrowser validates a configured/detected executable or downloads the
 * headless shell to Remotion's cache; we then verify the outcome and fail fast
 * with a precise error if no usable browser could be obtained. This is the
 * sanctioned Remotion way to guarantee the render's browser dependency.
 */
async function ensureRenderBrowser(browser: {
  browserExecutable: string | null;
  chromeMode: "headless-shell" | "chrome-for-testing";
}): Promise<void> {
  const status = await ensureBrowser({
    browserExecutable: browser.browserExecutable,
    chromeMode: browser.chromeMode,
  });
  if (status.type === "no-browser") {
    throw new BrowserUnavailableError();
  }
  const at = "path" in status ? ` (${status.path})` : "";
  console.info(`[render] browser ready: ${status.type}${at}`);
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
    // Provision + verify the browser before committing to the render, so a
    // missing browser is a fast, precise failure — not a mid-render crash.
    await ensureRenderBrowser(browser);
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
