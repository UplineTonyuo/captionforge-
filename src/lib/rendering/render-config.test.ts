import { describe, expect, it } from "vitest";

import {
  DEFAULT_OFFTHREAD_CACHE_MB,
  offthreadVideoCacheSizeInBytes,
  RENDER_CONCURRENCY,
  RENDER_MEDIA_OPTIONS,
} from "./render-config";

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

describe("offthreadVideoCacheSizeInBytes (OOM fix)", () => {
  it("caps the cache at the conservative default for a ~1GB container", () => {
    expect(DEFAULT_OFFTHREAD_CACHE_MB).toBe(256);
    // Never null — must always override Remotion's "half of system memory".
    expect(offthreadVideoCacheSizeInBytes({})).toBe(256 * 1024 * 1024);
  });

  it("honors CAPTIONFORGE_OFFTHREAD_CACHE_MB for runtime tuning", () => {
    expect(
      offthreadVideoCacheSizeInBytes({ CAPTIONFORGE_OFFTHREAD_CACHE_MB: "128" })
    ).toBe(128 * 1024 * 1024);
  });

  it("ignores invalid/non-positive overrides and uses the default", () => {
    for (const bad of ["", "0", "-50", "abc"]) {
      expect(
        offthreadVideoCacheSizeInBytes({ CAPTIONFORGE_OFFTHREAD_CACHE_MB: bad })
      ).toBe(DEFAULT_OFFTHREAD_CACHE_MB * 1024 * 1024);
    }
  });

  it("always returns a positive integer (never null)", () => {
    const bytes = offthreadVideoCacheSizeInBytes({});
    expect(Number.isInteger(bytes)).toBe(true);
    expect(bytes).toBeGreaterThan(0);
  });
});
