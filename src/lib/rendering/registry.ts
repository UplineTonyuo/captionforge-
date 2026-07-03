import { rm } from "node:fs/promises";

import type { RenderJob } from "@/lib/video/types";

/**
 * In-memory registry of render jobs for the MVP export flow. Deliberately
 * NOT persistence: state lives for the server process only (a restart loses
 * in-flight renders, which the client surfaces as a retryable error). The
 * durable job store arrives with TASKS.md M1.
 *
 * Cleanup: each job owns a temp directory (staged input + output). Expired
 * jobs are swept lazily on registry access and their directories removed.
 */

export interface RegisteredRender {
  job: RenderJob;
  /** Temp directory owning every file of this render. */
  tempDir: string;
  expiresAt: number;
}

/** Completed exports stay downloadable for 30 minutes. */
export const RENDER_TTL_MS = 30 * 60 * 1000;

const renders = new Map<string, RegisteredRender>();

function sweep(now = Date.now()): void {
  for (const [id, entry] of renders) {
    if (entry.expiresAt <= now) {
      renders.delete(id);
      // Fire-and-forget: cleanup failure must never break a request.
      void rm(entry.tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export function registerRender(job: RenderJob, tempDir: string): void {
  sweep();
  renders.set(job.id, { job, tempDir, expiresAt: Date.now() + RENDER_TTL_MS });
}

export function getRender(id: string): RegisteredRender | null {
  sweep();
  return renders.get(id) ?? null;
}

export function updateRender(
  id: string,
  patch: Partial<Pick<RenderJob, "status" | "progress" | "outputPath" | "error">>
): void {
  const entry = renders.get(id);
  if (!entry) return;
  Object.assign(entry.job, patch, { updatedAt: new Date().toISOString() });
}

/** True while any registered render is queued or actively rendering. */
export function hasActiveRender(): boolean {
  sweep();
  for (const { job } of renders.values()) {
    if (job.status === "queued" || job.status === "rendering") return true;
  }
  return false;
}

/** Test hook: clear all state and reclaim temp dirs immediately. */
export async function resetRegistryForTests(): Promise<void> {
  for (const entry of renders.values()) {
    await rm(entry.tempDir, { recursive: true, force: true }).catch(() => {});
  }
  renders.clear();
}
