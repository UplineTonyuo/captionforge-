import { describe, expect, it } from "vitest";

import {
  collectRenderDiagnostics,
  developerErrorMessage,
  formatRenderErrorLog,
} from "./diagnostics";

const ctx = { jobId: "job-123", bundlePath: "/tmp/bundle-abc" };

describe("render diagnostics", () => {
  it("collects the render environment snapshot", () => {
    const diag = collectRenderDiagnostics(ctx);
    // Keys the operator needs to explain a failure are all present.
    for (const key of [
      "node",
      "platform",
      "nodeEnv",
      "browserSource",
      "chromiumExecutable",
      "chromeMode",
      "env.CAPTIONFORGE_BROWSER_EXECUTABLE",
      "bundlePath",
      "ffmpegPath",
      "ffprobePath",
    ]) {
      expect(diag[key]).toBeTypeOf("string");
    }
    expect(diag.bundlePath).toBe("/tmp/bundle-abc");
  });

  it("logs the exact exception, stack, and env in the verbose block", () => {
    const err = new TypeError("boom while rendering");
    const log = formatRenderErrorLog(err, ctx);
    expect(log).toContain("[render] job job-123 failed");
    expect(log).toContain("exception: TypeError: boom while rendering");
    expect(log).toContain("stack:");
    expect(log).toContain("chromiumExecutable:");
    expect(log).toContain("bundlePath: /tmp/bundle-abc");
  });

  it("preserves non-Error throws", () => {
    expect(formatRenderErrorLog("plain string failure", ctx)).toContain(
      "exception: Error: plain string failure"
    );
  });

  it("builds a compact developer message with the exception and context", () => {
    const msg = developerErrorMessage(
      new Error("Failed to launch browser"),
      ctx
    );
    expect(msg).toContain("Error: Failed to launch browser");
    expect(msg).toContain("browser:");
    expect(msg).toContain("bundle: /tmp/bundle-abc");
    expect(msg).toContain("ffmpeg:");
  });
});
