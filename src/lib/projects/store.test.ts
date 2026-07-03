import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProbedMedia } from "@/lib/video/probe";
import type { UploadedVideo } from "@/lib/video/types";
import { newProject } from "./service";
import {
  JsonFileProjectStore,
  ProjectNotFoundError,
} from "./store";

const VIDEO: UploadedVideo = {
  id: "video-uuid",
  originalName: "clip.mp4",
  mimeType: "video/mp4",
  sizeBytes: 1234,
  uploadedAt: "2026-01-01T00:00:00.000Z",
};

const METADATA: ProbedMedia = {
  durationSeconds: 12.5,
  hasAudio: true,
  hasVideo: true,
  width: 1080,
  height: 1920,
  frameRate: 30,
};

function makeProject(overrides: { createdAt?: string; title?: string } = {}) {
  const project = newProject({ video: VIDEO, metadata: METADATA, title: overrides.title });
  return overrides.createdAt
    ? { ...project, createdAt: overrides.createdAt }
    : project;
}

describe("JsonFileProjectStore", () => {
  let dir: string;
  let store: JsonFileProjectStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "captionforge-projects-"));
    store = new JsonFileProjectStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips a created project", async () => {
    const project = makeProject();
    await store.create(project);
    expect(await store.get(project.id)).toEqual(project);
  });

  it("returns null for an unknown id", async () => {
    expect(await store.get("does-not-exist")).toBeNull();
  });

  it("lists projects newest-first and ignores non-project files", async () => {
    const older = makeProject({ createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeProject({ createdAt: "2026-02-01T00:00:00.000Z" });
    await store.create(older);
    await store.create(newer);
    // An orphaned temp write (simulating a crash between write and rename)
    // and unrelated files must never appear in listings.
    await writeFile(path.join(dir, ".orphan.abc.tmp"), "{ partial", "utf8");
    await writeFile(path.join(dir, "notes.txt"), "ignore me", "utf8");

    const ids = (await store.list()).map((p) => p.id);
    expect(ids).toEqual([newer.id, older.id]);
  });

  it("merge-updates, bumps updatedAt, and protects identity fields", async () => {
    const project = makeProject();
    await store.create(project);

    const updated = await store.update(project.id, {
      title: "Renamed",
      segments: [],
      // These must be ignored — identity is owned by the store.
      id: "hacked",
      createdAt: "1999-01-01T00:00:00.000Z",
    });

    expect(updated.id).toBe(project.id);
    expect(updated.createdAt).toBe(project.createdAt);
    expect(updated.title).toBe("Renamed");
    expect(updated.updatedAt >= project.updatedAt).toBe(true);
    // Persisted, not just returned.
    expect(await store.get(project.id)).toEqual(updated);
  });

  it("throws ProjectNotFoundError when updating an unknown id", async () => {
    await expect(store.update("nope", { title: "x" })).rejects.toBeInstanceOf(
      ProjectNotFoundError
    );
  });

  it("deletes a project and is idempotent for unknown ids", async () => {
    const project = makeProject();
    await store.create(project);
    await store.delete(project.id);
    expect(await store.get(project.id)).toBeNull();
    // Second delete (or delete of a never-existent id) must not throw.
    await expect(store.delete(project.id)).resolves.toBeUndefined();
    await expect(store.delete("never")).resolves.toBeUndefined();
  });

  it("a simulated crash mid-write leaves the previous version readable", async () => {
    const project = makeProject();
    await store.create(project);
    // Drop a garbage temp file as if a write was interrupted before rename.
    await writeFile(
      path.join(dir, `.${project.id}.interrupted.tmp`),
      "{ not valid json",
      "utf8"
    );
    // The committed record is untouched and still parseable.
    expect(await store.get(project.id)).toEqual(project);
  });

  it("rejects ids that could escape the data directory", async () => {
    await expect(store.get("../../etc/passwd")).rejects.toThrow(/Invalid project id/);
  });
});
