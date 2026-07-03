import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

import { probeMedia } from "@/lib/video/probe";
import { NoAudioError, TranscriptionFailedError } from "./errors";

const execFileAsync = promisify(execFile);

/**
 * ffmpeg audio-extraction adapter. Produces the 16 kHz mono WAV every STT
 * engine consumes (ARCHITECTURE.md §5.2), so engines stay codec-agnostic.
 * The only module allowed to invoke the ffmpeg binary.
 */

export interface ExtractedAudio {
  audioPath: string;
  durationSeconds: number;
  /** Removes the temp directory holding the WAV. Safe to call twice. */
  cleanup(): Promise<void>;
}

export async function extractAudio(videoPath: string): Promise<ExtractedAudio> {
  const media = await probeMedia(videoPath);
  if (!media.hasAudio) {
    throw new NoAudioError();
  }

  const dir = await mkdtemp(path.join(tmpdir(), "captionforge-audio-"));
  const audioPath = path.join(dir, "audio.wav");
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true });
  };

  try {
    await execFileAsync(ffmpegInstaller.path, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      "-y",
      audioPath,
    ]);
  } catch {
    await cleanup();
    throw new TranscriptionFailedError(
      "Could not extract audio from this video."
    );
  }

  return { audioPath, durationSeconds: media.durationSeconds, cleanup };
}
