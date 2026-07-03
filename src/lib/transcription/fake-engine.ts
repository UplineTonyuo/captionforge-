import type { Transcript, TranscriptWord } from "@/lib/video/types";
import type { TranscribeInput, TranscriptionEngine } from "./engine";

/**
 * Deterministic offline engine for development and tests
 * (CAPTIONFORGE_STT_ENGINE=fake). Paces a fixed script across the real audio
 * duration so timing-dependent behavior (karaoke emphasis, segmenting) is
 * exercised without a provider. Production-quality per DEVELOPMENT_RULES.md
 * §5: typed, deterministic, no test-only branches in real code paths.
 */

const SCRIPT =
  "This is a placeholder transcript from the fake engine. " +
  "Every word you see here is timed across your video's real duration. " +
  "Configure a real speech to text provider to caption actual speech.";

const WORD_SECONDS = 0.32;
const GAP_SECONDS = 0.06;

export class FakeTranscriptionEngine implements TranscriptionEngine {
  readonly name = "fake";

  async transcribe({ durationSeconds }: TranscribeInput): Promise<Transcript> {
    const words: TranscriptWord[] = [];
    let t = 0;
    for (const word of SCRIPT.split(" ")) {
      const end = t + WORD_SECONDS;
      if (end > durationSeconds) break;
      words.push({ word, startSeconds: t, endSeconds: end });
      t = end + GAP_SECONDS;
    }
    // Always yield at least one word so tiny fixtures still get captions.
    if (words.length === 0) {
      words.push({
        word: "placeholder",
        startSeconds: 0,
        endSeconds: Math.max(0.1, durationSeconds),
      });
    }
    return { language: "en", words };
  }
}
