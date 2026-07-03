import { segmentWords } from "@/lib/captions/segmenter";
import type { CaptionSegment } from "@/lib/video/types";
import { extractAudio } from "./audio";
import type { TranscriptionEngine } from "./engine";
import { EmptyTranscriptError, TranscriptionNotConfiguredError } from "./errors";
import { FakeTranscriptionEngine } from "./fake-engine";
import {
  GROQ_WHISPER,
  OpenAiWhisperEngine,
} from "./whisper-openai";

/**
 * Transcription orchestration: video file in, caption segments out.
 * Routes call this; engines and ffmpeg stay behind it (ARCHITECTURE.md §7).
 */

export interface TranscriptionResult {
  language: string;
  segments: CaptionSegment[];
}

/**
 * Resolve the configured engine. CAPTIONFORGE_STT_ENGINE takes precedence
 * ("openai" | "groq" | "fake"); otherwise the first provider with a key:
 * OpenAI (OPENAI_API_KEY), then Groq (GROQ_API_KEY).
 * Exported for tests; not for use by components.
 */
export interface TranscriptionEnv {
  CAPTIONFORGE_STT_ENGINE?: string;
  OPENAI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

export function getTranscriptionEngine(
  env: TranscriptionEnv = process.env as TranscriptionEnv
): TranscriptionEngine {
  const selected = env.CAPTIONFORGE_STT_ENGINE?.toLowerCase();

  if (selected === "fake") return new FakeTranscriptionEngine();
  if (selected === "openai") {
    if (!env.OPENAI_API_KEY) {
      throw new TranscriptionNotConfiguredError(
        "CAPTIONFORGE_STT_ENGINE=openai requires OPENAI_API_KEY to be set."
      );
    }
    return new OpenAiWhisperEngine(env.OPENAI_API_KEY);
  }
  if (selected === "groq") {
    if (!env.GROQ_API_KEY) {
      throw new TranscriptionNotConfiguredError(
        "CAPTIONFORGE_STT_ENGINE=groq requires GROQ_API_KEY to be set."
      );
    }
    return new OpenAiWhisperEngine(env.GROQ_API_KEY, GROQ_WHISPER);
  }
  if (selected !== undefined) {
    throw new TranscriptionNotConfiguredError(
      `Unknown CAPTIONFORGE_STT_ENGINE "${selected}" (expected "openai", "groq" or "fake").`
    );
  }

  if (env.OPENAI_API_KEY) return new OpenAiWhisperEngine(env.OPENAI_API_KEY);
  if (env.GROQ_API_KEY) {
    return new OpenAiWhisperEngine(env.GROQ_API_KEY, GROQ_WHISPER);
  }
  throw new TranscriptionNotConfiguredError();
}

/**
 * Full pipeline for one staged video: extract 16 kHz mono audio → STT →
 * §5.5 segmenting. Temp audio is always cleaned up; the caller owns the
 * video file's lifecycle.
 */
export async function transcribeVideo(
  videoPath: string,
  engine: TranscriptionEngine = getTranscriptionEngine()
): Promise<TranscriptionResult> {
  const audio = await extractAudio(videoPath);
  try {
    const transcript = await engine.transcribe({
      audioPath: audio.audioPath,
      durationSeconds: audio.durationSeconds,
    });
    const segments = segmentWords(transcript.words);
    if (segments.length === 0) {
      throw new EmptyTranscriptError();
    }
    return { language: transcript.language, segments };
  } finally {
    await audio.cleanup();
  }
}
