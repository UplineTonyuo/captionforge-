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
import { formatMemorySnapshot, memorySnapshot } from "./memory";
import {
  offthreadVideoCacheSizeInBytes,
  RENDER_MEDIA_OPTIONS,
} from "./render-config";

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

    // Phase diagnostics (observers only — no effect on rendering, concurrency,
    // or output): the LAST "[render] phase=..." line before a crash in the
    // server log identifies where the Chromium page died — selectComposition,
    // renderMedia startup, frame rendering, or encoding/muxing.
    // Cap the OffthreadVideo frame cache so it can't grow to Remotion's default
    // (half of detected memory) and OOM a small container (see ./render-config).
    const cacheBytes = offthreadVideoCacheSizeInBytes();
    console.info(
      `[render] memory-options offthreadVideoCacheSizeInBytes=${cacheBytes} (${Math.round(
        cacheBytes / (1024 * 1024)
      )}MB) concurrency=${RENDER_MEDIA_OPTIONS.concurrency}`
    );

    console.info("[render] phase=select-composition");
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
      offthreadVideoCacheSizeInBytes: cacheBytes,
      ...browser,
    });

    const fps = media.frameRate ?? composition.fps;
    const outputWidth = media.width ?? composition.width;
    const outputHeight = media.height ?? composition.height;
    const durationInFrames = Math.max(1, Math.round(media.durationSeconds * fps));
    console.info(
      `[render] phase=composition-selected ${outputWidth}x${outputHeight} fps=${fps} frames=${durationInFrames} concurrency=${RENDER_MEDIA_OPTIONS.concurrency}`
    );

    let lastBucket = -1;
    let lastStitch = "";
    await renderMedia({
      composition: {
        ...composition,
        width: outputWidth,
        height: outputHeight,
        fps,
        durationInFrames,
      },
      serveUrl,
      outputLocation: outputPath,
      inputProps,
      offthreadVideoCacheSizeInBytes: cacheBytes,
      ...browser,
      ...RENDER_MEDIA_OPTIONS,
      // Confirms renderMedia startup was reached and reports the concurrency
      // Remotion actually resolved (should be 1) + a memory baseline.
      onStart: ({ frameCount, parallelEncoding, resolvedConcurrency }) => {
        console.info(
          `[render] phase=render-start frames=${frameCount} resolvedConcurrency=${resolvedConcurrency} parallelEncoding=${parallelEncoding}`
        );
        console.info(`[render] memory@start ${formatMemorySnapshot(memorySnapshot())}`);
      },
      // Surface Chromium-side errors (e.g. renderer OOM / WebGL) that precede a
      // page crash. Error-level only; no secrets (composition console output).
      onBrowserLog: (log) => {
        if (log.type === "error") {
          console.error(`[render] chromium-error: ${log.text}`);
        }
      },
      onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
        const bucket = Math.floor(progress * 5); // log ~every 20%
        if (bucket !== lastBucket || stitchStage !== lastStitch) {
          lastBucket = bucket;
          lastStitch = stitchStage;
          console.info(
            `[render] phase=${stitchStage} rendered=${renderedFrames} encoded=${encodedFrames} pct=${Math.round(
              progress * 100
            )} ${formatMemorySnapshot(memorySnapshot())}`
          );
        }
        onProgress(Math.round(progress * 100));
      },
    });
    console.info("[render] phase=complete");
  } finally {
    await rm(stagedPath, { force: true });
  }
}
