import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";

import type { Transcript, TranscriptWord } from "@/lib/video/types";
import type { TranscribeInput, TranscriptionEngine } from "./engine";
import { EmptyTranscriptError, TranscriptionFailedError } from "./errors";

/**
 * Whisper adapter for OpenAI-compatible transcription APIs
 * (audio/transcriptions, verbose_json, word-level timestamps).
 * Used for both OpenAI and Groq — they share the same request/response
 * shape. Talks straight to the REST API; no SDK dependency.
 */

/** Providers reject uploads larger than 25 MB (~13 min of 16 kHz mono WAV). */
export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface WhisperProviderConfig {
  /** Engine id for logs, e.g. "openai-whisper". */
  name: string;
  apiUrl: string;
  model: string;
}

export const OPENAI_WHISPER: WhisperProviderConfig = {
  name: "openai-whisper",
  apiUrl: "https://api.openai.com/v1/audio/transcriptions",
  model: "whisper-1",
};

/** Groq's hosted Whisper — OpenAI-compatible, generous free tier. */
export const GROQ_WHISPER: WhisperProviderConfig = {
  name: "groq-whisper",
  apiUrl: "https://api.groq.com/openai/v1/audio/transcriptions",
  model: "whisper-large-v3-turbo",
};

interface VerboseJsonResponse {
  language?: string;
  words?: Array<{ word?: string; start?: number; end?: number }>;
}

export class OpenAiWhisperEngine implements TranscriptionEngine {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly provider: WhisperProviderConfig = OPENAI_WHISPER
  ) {
    this.name = provider.name;
  }

  async transcribe({ audioPath }: TranscribeInput): Promise<Transcript> {
    const { size } = await stat(audioPath);
    if (size > MAX_AUDIO_UPLOAD_BYTES) {
      throw new TranscriptionFailedError(
        "This video's audio is too long for transcription (about 13 minutes max). Try a shorter clip."
      );
    }

    const form = new FormData();
    form.append("file", await openAsBlob(audioPath), "audio.wav");
    form.append("model", this.provider.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");

    let response: Response;
    try {
      response = await fetch(this.provider.apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch {
      throw new TranscriptionFailedError(
        "Could not reach the transcription provider. Please try again."
      );
    }

    if (!response.ok) {
      // Never surface provider response bodies to users; log-worthy detail
      // stays server-side (the route logs the thrown error).
      throw new TranscriptionFailedError(
        `Transcription provider returned an error (HTTP ${response.status}). Please try again.`
      );
    }

    let payload: VerboseJsonResponse;
    try {
      payload = (await response.json()) as VerboseJsonResponse;
    } catch {
      throw new TranscriptionFailedError();
    }

    const words: TranscriptWord[] = (payload.words ?? [])
      .filter(
        (w): w is { word: string; start: number; end: number } =>
          typeof w.word === "string" &&
          typeof w.start === "number" &&
          typeof w.end === "number" &&
          w.end > w.start
      )
      .map((w) => ({
        word: w.word.trim(),
        startSeconds: w.start,
        endSeconds: w.end,
      }))
      .filter((w) => w.word.length > 0);

    if (words.length === 0) {
      throw new EmptyTranscriptError();
    }

    return { language: payload.language ?? "und", words };
  }
}
