import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmptyTranscriptError, TranscriptionFailedError } from "./errors";
import { OpenAiWhisperEngine } from "./whisper-openai";

let dir: string;
let audioPath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "captionforge-whisper-test-"));
  audioPath = path.join(dir, "audio.wav");
  await writeFile(audioPath, Buffer.from("RIFF fake wav"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

function stubFetch(response: Partial<Response> | Error) {
  const impl =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response as Response);
  vi.stubGlobal("fetch", impl);
  return impl;
}

const input = { audioPath: "", durationSeconds: 3 };

describe("OpenAiWhisperEngine", () => {
  it("maps verbose_json words to TranscriptWord and trims whitespace", async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({
        language: "english",
        words: [
          { word: " If ", start: 0, end: 0.22 },
          { word: "tomorrow", start: 0.3, end: 0.9 },
          { word: "", start: 1, end: 1.2 }, // dropped: empty after trim
          { word: "bad", start: 2, end: 2 }, // dropped: zero duration
        ],
      }),
    });

    const engine = new OpenAiWhisperEngine("sk-test");
    const transcript = await engine.transcribe({ ...input, audioPath });

    expect(transcript.language).toBe("english");
    expect(transcript.words).toEqual([
      { word: "If", startSeconds: 0, endSeconds: 0.22 },
      { word: "tomorrow", startSeconds: 0.3, endSeconds: 0.9 },
    ]);

    // Request shape: multipart with model + word granularity, bearer auth.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test"
    );
    const body = init.body as FormData;
    expect(body.get("model")).toBe("whisper-1");
    expect(body.get("response_format")).toBe("verbose_json");
    expect(body.getAll("timestamp_granularities[]")).toEqual(["word"]);
  });

  it("throws EmptyTranscriptError when no usable words come back", async () => {
    stubFetch({ ok: true, json: async () => ({ language: "en", words: [] }) });
    const engine = new OpenAiWhisperEngine("sk-test");
    await expect(engine.transcribe({ ...input, audioPath })).rejects.toThrow(
      EmptyTranscriptError
    );
  });

  it("throws TranscriptionFailedError on provider HTTP errors", async () => {
    stubFetch({ ok: false, status: 429, json: async () => ({}) });
    const engine = new OpenAiWhisperEngine("sk-test");
    await expect(engine.transcribe({ ...input, audioPath })).rejects.toThrow(
      TranscriptionFailedError
    );
  });

  it("throws TranscriptionFailedError on network failure", async () => {
    stubFetch(new Error("ECONNRESET"));
    const engine = new OpenAiWhisperEngine("sk-test");
    await expect(engine.transcribe({ ...input, audioPath })).rejects.toThrow(
      TranscriptionFailedError
    );
  });
});
