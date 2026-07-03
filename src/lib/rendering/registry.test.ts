import { mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRenderJob } from "@/lib/video/render";
import {
  getRender,
  hasActiveRender,
  registerRender,
  RENDER_TTL_MS,
  resetRegistryForTests,
  updateRender,
} from "./registry";

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "captionforge-registry-test-"));
  await writeFile(path.join(dir, "out.mp4"), "fake");
  return dir;
}

afterEach(async () => {
  vi.useRealTimers();
  await resetRegistryForTests();
});

describe("render registry", () => {
  it("stores, retrieves, and updates jobs", async () => {
    const job = createRenderJob("vid-1");
    registerRender(job, await makeTempDir());

    expect(getRender(job.id)?.job.status).toBe("queued");
    expect(getRender("nope")).toBeNull();

    updateRender(job.id, { status: "rendering", progress: 40 });
    const entry = getRender(job.id);
    expect(entry).not.toBeNull();
    expect(entry?.job.progress).toBe(40);
    expect(entry!.job.updatedAt >= entry!.job.createdAt).toBe(true);
  });

  it("tracks whether any render is active", async () => {
    expect(hasActiveRender()).toBe(false);
    const job = createRenderJob("vid-2");
    registerRender(job, await makeTempDir());
    expect(hasActiveRender()).toBe(true);
    updateRender(job.id, { status: "completed", progress: 100 });
    expect(hasActiveRender()).toBe(false);
  });

  it("expires jobs after the TTL and removes their temp dirs", async () => {
    vi.useFakeTimers();
    const dir = await makeTempDir();
    const job = createRenderJob("vid-3");
    registerRender(job, dir);
    expect(getRender(job.id)).not.toBeNull();

    vi.setSystemTime(Date.now() + RENDER_TTL_MS + 1000);
    expect(getRender(job.id)).toBeNull(); // lazy sweep on access

    // rm is fire-and-forget; give the event loop a real tick.
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(existsSync(dir)).toBe(false);
  });
});
