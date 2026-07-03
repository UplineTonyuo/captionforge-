import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { UPLOAD_DIR } from "./constants";
import type { UploadedVideo } from "./types";

/**
 * Local-disk staging for uploaded videos.
 *
 * This is intentionally a thin module boundary: when the app moves to object
 * storage (S3, GCS, ...) only this file should need to change.
 */

function uploadRoot(): string {
  return path.join(process.cwd(), UPLOAD_DIR);
}

export function generateVideoId(): string {
  return crypto.randomUUID();
}

export function videoPath(id: string): string {
  // The id is a server-generated UUID, so it is safe to use as a filename.
  return path.join(uploadRoot(), `${id}.mp4`);
}

export async function saveVideoStream(
  id: string,
  stream: ReadableStream<Uint8Array>
): Promise<number> {
  await mkdir(uploadRoot(), { recursive: true });
  const destination = videoPath(id);
  await pipeline(
    Readable.fromWeb(stream as import("node:stream/web").ReadableStream),
    createWriteStream(destination)
  );
  const { size } = await stat(destination);
  return size;
}

export function toUploadedVideo(params: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): UploadedVideo {
  return {
    ...params,
    uploadedAt: new Date().toISOString(),
  };
}
