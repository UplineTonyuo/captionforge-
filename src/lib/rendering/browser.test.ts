import { describe, expect, it } from "vitest";

import { resolveBrowserExecutable } from "./browser";

const never = () => false;
const always = () => true;

describe("resolveBrowserExecutable", () => {
  it("prefers CAPTIONFORGE_BROWSER_EXECUTABLE when set", () => {
    const r = resolveBrowserExecutable(
      { CAPTIONFORGE_BROWSER_EXECUTABLE: "/opt/chrome" },
      "linux",
      never
    );
    expect(r).toEqual({
      browserExecutable: "/opt/chrome",
      chromeMode: "chrome-for-testing",
      source: "env",
    });
  });

  it("trims a padded executable path and ignores an empty one", () => {
    expect(
      resolveBrowserExecutable(
        { CAPTIONFORGE_BROWSER_EXECUTABLE: "  /opt/chrome  " },
        "linux",
        never
      ).browserExecutable
    ).toBe("/opt/chrome");
    // Whitespace-only is treated as unset → falls through to download.
    expect(
      resolveBrowserExecutable(
        { CAPTIONFORGE_BROWSER_EXECUTABLE: "   " },
        "linux",
        never
      ).source
    ).toBe("download");
  });

  it("detects a Windows Chrome install path", () => {
    const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const r = resolveBrowserExecutable({}, "win32", (p) => p === chrome);
    expect(r.source).toBe("detected");
    expect(r.browserExecutable).toBe(chrome);
    expect(r.chromeMode).toBe("chrome-for-testing");
  });

  it("detects a per-user Windows install via LOCALAPPDATA", () => {
    const local = "C:\\Users\\me\\AppData\\Local";
    const chrome = `${local}\\Google\\Chrome\\Application\\chrome.exe`;
    const r = resolveBrowserExecutable(
      { LOCALAPPDATA: local },
      "win32",
      (p) => p === chrome
    );
    expect(r.browserExecutable).toBe(chrome);
    expect(r.source).toBe("detected");
  });

  it("detects a macOS Chrome install", () => {
    const r = resolveBrowserExecutable({}, "darwin", always);
    expect(r.source).toBe("detected");
    expect(r.browserExecutable).toContain("Google Chrome");
  });

  it("falls back to the headless-shell download when nothing is found", () => {
    const r = resolveBrowserExecutable({}, "linux", never);
    expect(r).toEqual({
      browserExecutable: null,
      chromeMode: "headless-shell",
      source: "download",
    });
  });
});
