import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { NextResponse } from "next/server";

import {
  InvalidRenderPayloadError,
  parseSegments,
  parseStyle,
  startRender,
} from "@/lib/rendering";
import {
  formatBytes,
  isAcceptedVideoType,
  MAX_UPLOAD_BYTES,
} from "@/lib/video/constants";
import type {
  RenderStatusResponse,
  UploadErrorResponse,
} from "@/lib/video/types";

export const runtime = "nodejs";

function errorJson(message: string, status: number) {
  return NextResponse.json<UploadErrorResponse>({ error: message }, { status });
}

/**
 * Start an export: multipart body with the source MP4 ("file"), caption
 * segments ("segments", JSON) and style ("style", JSON). Responds 202 with a
 * render id to poll at GET /api/render/:id. Nothing persists — render state
 * is in-memory and files live in a TTL-reclaimed temp dir.
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

  const segmentsField = formData.get("segments");
  const styleField = formData.get("style");
  if (typeof segmentsField !== "string" || typeof styleField !== "string") {
    return errorJson('Missing "segments" or "style" field in form data.', 400);
  }

  try {
    const segments = parseSegments(segmentsField);
    const style = parseStyle(styleField);

    const tempDir = await mkdtemp(path.join(tmpdir(), "captionforge-render-"));
    const videoPath = path.join(tempDir, "source.mp4");
    await pipeline(
      Readable.fromWeb(
        file.stream() as import("node:stream/web").ReadableStream
      ),
      createWriteStream(videoPath)
    );

    const job = startRender({ videoPath, tempDir, segments, style });
    return NextResponse.json<RenderStatusResponse>(
      {
        renderId: job.id,
        status: job.status,
        progress: job.progress,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof InvalidRenderPayloadError) {
      return errorJson(error.message, 400);
    }
    console.error("[render] failed to start:", error);
    return errorJson("Could not start the export. Please try again.", 500);
  }
}
