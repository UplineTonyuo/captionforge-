import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

import { resolveBrowserExecutable } from "./browser";

/**
 * Render failure diagnostics. Gathers everything needed to explain why an
 * export failed — the exact exception, browser acquisition, executable/bundle/
 * ffmpeg paths, and render-relevant env — without touching the render logic.
 *
 * Secrets are never included (no API keys); only render-relevant, non-secret
 * values are reported.
 */

export interface RenderErrorContext {
  jobId: string;
  /** The Remotion bundle serve URL, if the bundle was built before failing. */
  bundlePath?: string;
}

function tryPath(read: () => string): string {
  try {
    return read();
  } catch {
    return "(unavailable)";
  }
}

/** True unless explicitly running a production build (Next dev sets development). */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** A snapshot of the render environment, safe to log and (in dev) surface. */
export function collectRenderDiagnostics(
  context: RenderErrorContext
): Record<string, string> {
  const browser = resolveBrowserExecutable();
  return {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
    browserSource: browser.source,
    chromiumExecutable:
      browser.browserExecutable ??
      "(none — Remotion will download a headless shell)",
    chromeMode: browser.chromeMode,
    "env.CAPTIONFORGE_BROWSER_EXECUTABLE":
      process.env.CAPTIONFORGE_BROWSER_EXECUTABLE ?? "(unset)",
    "env.CAPTIONFORGE_STT_ENGINE":
      process.env.CAPTIONFORGE_STT_ENGINE ?? "(unset)",
    bundlePath: context.bundlePath ?? "(bundle not built)",
    ffmpegPath: tryPath(() => ffmpegInstaller.path),
    ffprobePath: tryPath(() => ffprobeInstaller.path),
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * The verbose block written to the server terminal: exact exception name and
 * message, the full stack trace, and the environment snapshot.
 */
export function formatRenderErrorLog(
  error: unknown,
  context: RenderErrorContext
): string {
  const err = asError(error);
  const diag = collectRenderDiagnostics(context);
  return [
    `[render] job ${context.jobId} failed`,
    `  exception: ${err.name}: ${err.message}`,
    ...Object.entries(diag).map(([key, value]) => `  ${key}: ${value}`),
    "  stack:",
    (err.stack ?? "(no stack available)")
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n"),
  ].join("\n");
}

/**
 * A compact, single-string version for the UI in development: the exact
 * exception plus the browser/bundle/ffmpeg context and a pointer to the log.
 * Never used in production (see isDevelopment).
 */
export function developerErrorMessage(
  error: unknown,
  context: RenderErrorContext
): string {
  const err = asError(error);
  const diag = collectRenderDiagnostics(context);
  return [
    `${err.name}: ${err.message}`,
    `browser: ${diag.chromiumExecutable} (${diag.browserSource})`,
    `bundle: ${diag.bundlePath}`,
    `ffmpeg: ${diag.ffmpegPath}`,
    "See the dev server terminal for the full stack trace.",
  ].join(" · ");
}
