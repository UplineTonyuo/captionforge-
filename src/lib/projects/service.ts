import { DEFAULT_CAPTION_STYLE } from "@/lib/captions/style";
import type { ProbedMedia } from "@/lib/video/probe";
import type { Project, UploadedVideo } from "@/lib/video/types";

/**
 * Project orchestration helpers. The upload service (TASKS.md M1.4) composes
 * these with the ProjectStore: stage video -> probe -> newProject -> store.create.
 * Kept separate from store.ts so the store stays pure CRUD.
 */

/** A human title derived from the uploaded filename, sans extension. */
export function deriveProjectTitle(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, "").trim();
  return base.length > 0 ? base : "Untitled project";
}

/**
 * Build a fresh Project record for a just-uploaded video. Ids and timestamps
 * are server-generated; segments start empty and style defaults to the
 * PrimeClip default until the user edits them.
 */
export function newProject(params: {
  video: UploadedVideo;
  metadata: ProbedMedia;
  title?: string;
}): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: params.title ?? deriveProjectTitle(params.video.originalName),
    video: params.video,
    metadata: params.metadata,
    segments: [],
    style: DEFAULT_CAPTION_STYLE,
    createdAt: now,
    updatedAt: now,
  };
}
