import { existsSync } from "node:fs";

/**
 * Resolves which Chromium-family browser Remotion should use to paint frames.
 *
 * Order of preference:
 *   1. CAPTIONFORGE_BROWSER_EXECUTABLE, if set (explicit override).
 *   2. A Chrome/Edge/Chromium installed at a well-known OS path.
 *   3. Fall back to Remotion downloading its own headless shell (needs network;
 *      the fragile path that fails behind firewalls / offline).
 *
 * Pure and dependency-injected (platform + an `exists` probe) so it is unit
 * tested without a real filesystem.
 */

export type ChromeMode = "headless-shell" | "chrome-for-testing";

export interface BrowserResolution {
  browserExecutable: string | null;
  chromeMode: ChromeMode;
  /** How the browser was chosen — for a one-line server log. */
  source: "env" | "detected" | "download";
}

/** Well-known install locations per platform (checked in order). */
const CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
};

function candidatesFor(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>
): string[] {
  const list = [...(CANDIDATES[platform] ?? [])];
  if (platform === "win32" && env.LOCALAPPDATA) {
    list.push(`${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`);
  }
  return list;
}

export function resolveBrowserExecutable(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
  platform: NodeJS.Platform = process.platform,
  exists: (path: string) => boolean = existsSync
): BrowserResolution {
  const configured = env.CAPTIONFORGE_BROWSER_EXECUTABLE?.trim();
  if (configured) {
    return {
      browserExecutable: configured,
      chromeMode: "chrome-for-testing",
      source: "env",
    };
  }

  const found = candidatesFor(platform, env).find((p) => exists(p));
  if (found) {
    return {
      browserExecutable: found,
      chromeMode: "chrome-for-testing",
      source: "detected",
    };
  }

  return {
    browserExecutable: null,
    chromeMode: "headless-shell",
    source: "download",
  };
}
