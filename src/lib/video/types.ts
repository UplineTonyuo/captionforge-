/**
 * Core domain types for CaptionForge's video pipeline.
 *
 * These types are shared between the upload flow that exists today and the
 * caption/render pipeline that will be built on top of it.
 */

import type { ProbedMedia } from "./probe";

export interface UploadedVideo {
  /** Server-generated identifier for the uploaded video. */
  id: string;
  /** Original filename as provided by the client. */
  originalName: string;
  /** MIME type reported at upload time (validated to be an accepted type). */
  mimeType: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** ISO-8601 timestamp of when the upload completed. */
  uploadedAt: string;
}

/** A single transcribed word with timing, in seconds relative to video start. */
export interface TranscriptWord {
  word: string;
  startSeconds: number;
  endSeconds: number;
  /** 0–1 confidence reported by the STT engine, when available. */
  confidence?: number;
}

/** A word inside a caption segment; emphasis can be overridden manually. */
export interface CaptionWord extends TranscriptWord {
  /** Manual emphasis override; karaoke (active-word) emphasis is time-driven. */
  emphasized?: boolean;
}

/** Raw output of a speech-to-text engine. Stored verbatim, never mutated. */
export interface Transcript {
  /** BCP-47 language tag reported by the engine, e.g. "en". */
  language: string;
  words: TranscriptWord[];
}

/** A single timed caption group, in seconds relative to the start of the video. */
export interface CaptionSegment {
  id: string;
  startSeconds: number;
  endSeconds: number;
  words: CaptionWord[];
  /** Derived display text: words.map(w => w.word).join(" "). */
  text: string;
}

export type CaptionPosition = "top" | "center" | "bottom";
export type CaptionSizePreset = "sm" | "md" | "lg";

/**
 * User-tunable caption styling (PROJECT_SPEC.md §5.6). Everything else about
 * the PrimeClip look is fixed by the style system in src/lib/captions/style.ts.
 */
export interface CaptionStyle {
  position: CaptionPosition;
  /** One of HIGHLIGHT_PALETTE in src/lib/captions/style.ts. */
  highlightColor: string;
  sizePreset: CaptionSizePreset;
}

export type RenderJobStatus =
  | "queued"
  | "transcribing"
  | "rendering"
  | "completed"
  | "failed";

/** A caption-burn render job. Rendering itself is not implemented yet. */
export interface RenderJob {
  id: string;
  videoId: string;
  status: RenderJobStatus;
  /** 0–100 progress for the current stage. */
  progress: number;
  segments: CaptionSegment[];
  style: CaptionStyle;
  createdAt: string;
  updatedAt: string;
  /** Populated when status is "completed". */
  outputPath?: string;
  /** Populated when status is "failed". */
  error?: string;
}

/**
 * A persisted project: one uploaded video plus everything derived from it
 * (transcript, caption segments, style, latest render). This is the durable
 * unit the editor loads and re-renders (FR-2). Segments and style live here,
 * not on jobs, so edits are independent of any in-flight render.
 */
export interface Project {
  id: string;
  title: string;
  video: UploadedVideo;
  /** ffprobe metadata captured at upload time. */
  metadata: ProbedMedia;
  /** Raw STT output, stored verbatim and never mutated; set once transcribed. */
  transcript?: Transcript;
  segments: CaptionSegment[];
  style: CaptionStyle;
  latestRender?: { jobId: string; path: string; renderedAt: string };
  createdAt: string;
  updatedAt: string;
}

export type JobKind = "transcription" | "render";

export type JobStatus = "queued" | "running" | "completed" | "failed";

/**
 * A unit of long-running work against a project. Generalizes the older
 * per-request RenderJob: a Job references its project by id and carries no
 * segments/style of its own (those belong to the Project).
 */
export interface Job {
  id: string;
  kind: JobKind;
  projectId: string;
  status: JobStatus;
  /** 0–100 progress for the current stage. */
  progress: number;
  /** Populated when status is "failed". */
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  video: UploadedVideo;
}

export interface UploadErrorResponse {
  error: string;
}

/** Response of POST /api/transcribe. */
export interface TranscribeResponse {
  language: string;
  segments: CaptionSegment[];
}

/** Public view of a render job (POST /api/render, GET /api/render/:id). */
export interface RenderStatusResponse {
  renderId: string;
  status: RenderJobStatus;
  /** 0–100. */
  progress: number;
  /** User-facing message, present when status is "failed". */
  error?: string;
}
