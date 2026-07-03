import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { NextResponse } from "next/server";

import {
  EmptyTranscriptError,
  NoAudioError,
  TranscriptionFailedError,
  TranscriptionNotConfiguredError,
  transcribeVideo,
} from "@/lib/transcription";
import {
  formatBytes,
  isAcceptedVideoType,
  MAX_UPLOAD_BYTES,
} from "@/lib/video/constants";
import { UnreadableMediaError } from "@/lib/video/probe";
import type { TranscribeResponse, UploadErrorResponse } from "@/lib/video/types";

export const runtime = "nodejs";
/** Transcription of a full clip can take minutes on hosted platforms. */
export const maxDuration = 300;

function errorJson(message: string, status: number) {
  return NextResponse.json<UploadErrorResponse>({ error: message }, { status });
}

/**
 * Synchronous transcription for the MVP preview flow: MP4 in, caption
 * segments out. Nothing is persisted — the staged video lives in a temp dir
 * for the duration of the request (job-based processing arrives with the
 * project store, TASKS.md M1/M2.5).
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson('Expected multipart/form-data with a "file" field.', 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorJson('Missing "file" field in form data.', 400);
  }
  if (!isAcceptedVideoType(file.type)) {
    return errorJson("Only MP4 videos are supported right now.", 415);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorJson(
      `File is too large (${formatBytes(file.size)}). The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      413
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "captionforge-transcribe-"));
  const videoPath = path.join(dir, "source.mp4");
  try {
    await pipeline(
      Readable.fromWeb(
        file.stream() as import("node:stream/web").ReadableStream
      ),
      createWriteStream(videoPath)
    );

    const result = await transcribeVideo(videoPath);
    return NextResponse.json<TranscribeResponse>(result);
  } catch (error) {
    if (
      error instanceof UnreadableMediaError ||
      error instanceof NoAudioError ||
      error instanceof EmptyTranscriptError
    ) {
      return errorJson(error.message, 422);
    }
    if (error instanceof TranscriptionNotConfiguredError) {
      console.error("[transcribe] not configured:", error.message);
      return errorJson(error.message, 503);
    }
    if (error instanceof TranscriptionFailedError) {
      console.error("[transcribe] engine failure:", error.message);
      return errorJson(error.message, 502);
    }
    console.error("[transcribe] unexpected failure:", error);
    return errorJson("Something went wrong while transcribing. Please try again.", 500);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
