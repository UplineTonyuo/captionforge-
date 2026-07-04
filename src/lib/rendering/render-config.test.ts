import { describe, expect, it } from "vitest";

import { RENDER_CONCURRENCY, RENDER_MEDIA_OPTIONS } from "./render-config";

describe("render media options", () => {
  it("renders at concurrency 1 to bound peak memory (Railway OOM fix)", () => {
    // Single Chromium tab / one frame at a time — the low-memory setting.
    expect(RENDER_CONCURRENCY).toBe(1);
    expect(RENDER_MEDIA_OPTIONS.concurrency).toBe(1);
  });

  it("leaves codec and quality settings unchanged (no visual/codec change)", () => {
    expect(RENDER_MEDIA_OPTIONS.codec).toBe("h264");
    expect(RENDER_MEDIA_OPTIONS.jpegQuality).toBe(100);
    expect(RENDER_MEDIA_OPTIONS.crf).toBe(16);
    expect(RENDER_MEDIA_OPTIONS.audioBitrate).toBe("320k");
  });
});
