import type { Transcript } from "@/lib/video/types";

/**
 * Speech-to-text service boundary (ARCHITECTURE.md §7). UI components and
 * routes never see a concrete engine — they call the transcription service,
 * which resolves an engine through getTranscriptionEngine(). Swapping Whisper
 * for Deepgram/AssemblyAI etc. means adding one adapter file here.
 */

export interface TranscribeInput {
  /** Path to a 16 kHz mono WAV produced by audio.ts. */
  audioPath: string;
  /** Duration of the audio, from the media probe. */
  durationSeconds: number;
}

export interface TranscriptionEngine {
  /** Human-readable engine id for logs ("openai-whisper", "fake"). */
  readonly name: string;
  /** Must reject with TranscriptionFailedError (or subclass) on failure. */
  transcribe(input: TranscribeInput): Promise<Transcript>;
}
