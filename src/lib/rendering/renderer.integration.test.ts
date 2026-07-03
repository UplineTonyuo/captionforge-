import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { segmentFromWords } from "@/lib/captions/demo";
import { DEFAULT_CAPTION_STYLE } from "@/lib/captions/style";
import { probeMedia } from "@/lib/video/probe";
import { getRemotionBundle } from "./bundle";
import { renderCaptionedVideo } from "./renderer";

const execFileAsync = promisify(execFile);

/**
 * Full server-side render: bundle the Remotion project, burn captions into a
 * generated H.264 fixture, verify the output geometry matches the source.
 * Slow by nature (webpack bundle + real render) — this is the test that
 * proves the export pipeline works at all.
 */

const BROWSER = process.env.CAPTIONFORGE_BROWSER_EXECUTABLE;

let dir: string;
let source: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "captionforge-render-test-"));
  source = path.join(dir, "source.mp4");
  await execFileAsync(ffmpegInstaller.path, [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=2",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-pix_fmt", "yuv420p", "-c:v", "libx264", "-shortest", "-y", source,
  ]);
}, 120_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe.skipIf(!BROWSER)("renderCaptionedVideo", () => {
  it(
    "burns captions into an MP4 matching the source geometry",
    { timeout: 300_000 },
    async () => {
      const outputPath = path.join(dir, "out.mp4");
      const serveUrl = await getRemotionBundle();
      const progress: number[] = [];

      await renderCaptionedVideo({
        videoPath: source,
        segments: [
          segmentFromWords("s1", [
            ["Hello", 0.0, 0.5],
            ["render", 0.5, 1.0, true],
          ]),
          segmentFromWords("s2", [["world", 1.2, 1.9]]),
        ],
        style: DEFAULT_CAPTION_STYLE,
        outputPath,
        serveUrl,
        onProgress: (pct) => progress.push(pct),
      });

      const { size } = await stat(outputPath);
      expect(size).toBeGreaterThan(10_000);

      const media = await probeMedia(outputPath);
      expect(media.width).toBe(640);
      expect(media.height).toBe(360);
      expect(media.frameRate).toBeCloseTo(30, 1);
      expect(media.durationSeconds).toBeGreaterThan(1.8);
      expect(media.durationSeconds).toBeLessThan(2.3);
      expect(media.hasAudio).toBe(true);

      // Progress must be reported and increase.
      expect(progress.length).toBeGreaterThan(1);
      expect(progress[progress.length - 1]).toBeGreaterThan(progress[0]);

      // The staged input inside the bundle's public dir must be cleaned up.
      const staged = path.join(serveUrl, "public", "render-inputs");
      const { readdir } = await import("node:fs/promises");
      const leftovers = await readdir(staged).catch(() => []);
      expect(leftovers).toEqual([]);
    }
  );
});
