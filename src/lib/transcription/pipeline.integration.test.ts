import { execFile } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { probeMedia, UnreadableMediaError } from "@/lib/video/probe";
import { extractAudio } from "./audio";
import { NoAudioError } from "./errors";
import { FakeTranscriptionEngine } from "./fake-engine";
import { transcribeVideo } from "./service";

const execFileAsync = promisify(execFile);

/**
 * Integration tests against the real ffmpeg/ffprobe binaries shipped via npm.
 * Fixtures are generated on the fly (2 s of test video, with/without a sine
 * audio track) instead of committing binaries to the repo.
 */

let dir: string;
let withAudio: string;
let noAudio: string;
let notAVideo: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "captionforge-pipeline-test-"));
  withAudio = path.join(dir, "with-audio.mp4");
  noAudio = path.join(dir, "no-audio.mp4");
  notAVideo = path.join(dir, "not-a-video.mp4");

  await execFileAsync(ffmpegInstaller.path, [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15:duration=2",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-pix_fmt", "yuv420p", "-shortest", "-y", withAudio,
  ]);
  await execFileAsync(ffmpegInstaller.path, [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15:duration=2",
    "-pix_fmt", "yuv420p", "-y", noAudio,
  ]);
  await execFileAsync("cp", ["/dev/null", notAVideo]);
}, 120_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("probeMedia", () => {
  it("reads duration and stream layout from a real MP4", async () => {
    const media = await probeMedia(withAudio);
    expect(media.durationSeconds).toBeGreaterThan(1.8);
    expect(media.durationSeconds).toBeLessThan(2.5);
    expect(media.hasAudio).toBe(true);
    expect(media.hasVideo).toBe(true);
  });

  it("rejects unreadable files with a typed error", async () => {
    await expect(probeMedia(notAVideo)).rejects.toThrow(UnreadableMediaError);
  });
});

describe("extractAudio", () => {
  it("produces a 16 kHz mono WAV and cleans up after itself", async () => {
    const audio = await extractAudio(withAudio);
    try {
      const { stdout } = await execFileAsync(
        (await import("@ffprobe-installer/ffprobe")).default.path,
        [
          "-v", "error",
          "-show_entries", "stream=sample_rate,channels,codec_name",
          "-of", "json", audio.audioPath,
        ]
      );
      const stream = (
        JSON.parse(stdout) as {
          streams: Array<{ sample_rate: string; channels: number; codec_name: string }>;
        }
      ).streams[0];
      expect(stream.sample_rate).toBe("16000");
      expect(stream.channels).toBe(1);
      expect(stream.codec_name).toBe("pcm_s16le");
    } finally {
      await audio.cleanup();
    }
    await expect(access(audio.audioPath)).rejects.toThrow();
  });

  it("rejects videos without an audio track", async () => {
    await expect(extractAudio(noAudio)).rejects.toThrow(NoAudioError);
  });
});

describe("transcribeVideo (full pipeline, fake engine)", () => {
  it("turns an MP4 into non-overlapping caption segments", async () => {
    const result = await transcribeVideo(
      withAudio,
      new FakeTranscriptionEngine()
    );
    expect(result.language).toBe("en");
    expect(result.segments.length).toBeGreaterThan(0);
    for (const segment of result.segments) {
      expect(segment.words.length).toBeGreaterThan(0);
      expect(segment.startSeconds).toBeLessThan(segment.endSeconds);
      expect(segment.text).toBe(segment.words.map((w) => w.word).join(" "));
    }
    for (let i = 1; i < result.segments.length; i++) {
      expect(result.segments[i].startSeconds).toBeGreaterThanOrEqual(
        result.segments[i - 1].endSeconds - 1e-9
      );
    }
  });
});
