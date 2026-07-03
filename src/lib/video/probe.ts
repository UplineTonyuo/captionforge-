import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ffprobeInstaller from "@ffprobe-installer/ffprobe";

const execFileAsync = promisify(execFile);

/**
 * ffprobe adapter — the only module allowed to invoke the ffprobe binary
 * (DEVELOPMENT_RULES.md §3 "Adapters own the outside world").
 */

export interface ProbedMedia {
  durationSeconds: number;
  hasAudio: boolean;
  hasVideo: boolean;
  /** Present when hasVideo. */
  width?: number;
  height?: number;
  frameRate?: number;
}

export class UnreadableMediaError extends Error {
  constructor(message = "Could not read this file as a video.") {
    super(message);
    this.name = "UnreadableMediaError";
  }
}

interface FfprobeOutput {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
  }>;
  format?: { duration?: string };
}

/** avg_frame_rate is a fraction like "30000/1001". */
function parseFrameRate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0 || num <= 0) {
    return undefined;
  }
  return num / den;
}

export async function probeMedia(filePath: string): Promise<ProbedMedia> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(ffprobeInstaller.path, [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,width,height,avg_frame_rate:format=duration",
      "-of",
      "json",
      filePath,
    ]));
  } catch {
    throw new UnreadableMediaError();
  }

  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new UnreadableMediaError();
  }

  const streams = parsed.streams ?? [];
  const durationSeconds = Number(parsed.format?.duration ?? NaN);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new UnreadableMediaError();
  }

  const video = streams.find((s) => s.codec_type === "video");
  return {
    durationSeconds,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hasVideo: video !== undefined,
    width: video?.width,
    height: video?.height,
    frameRate: parseFrameRate(video?.avg_frame_rate),
  };
}
