import { describe, expect, it } from "vitest";

import { FakeTranscriptionEngine } from "./fake-engine";
import { OpenAiWhisperEngine } from "./whisper-openai";
import { TranscriptionNotConfiguredError } from "./errors";
import { getTranscriptionEngine } from "./service";

describe("getTranscriptionEngine", () => {
  it("selects the fake engine when CAPTIONFORGE_STT_ENGINE=fake", () => {
    const engine = getTranscriptionEngine({ CAPTIONFORGE_STT_ENGINE: "fake" });
    expect(engine).toBeInstanceOf(FakeTranscriptionEngine);
  });

  it("selects OpenAI Whisper when a key is present", () => {
    expect(
      getTranscriptionEngine({ OPENAI_API_KEY: "sk-test" })
    ).toBeInstanceOf(OpenAiWhisperEngine);
    expect(
      getTranscriptionEngine({
        CAPTIONFORGE_STT_ENGINE: "openai",
        OPENAI_API_KEY: "sk-test",
      })
    ).toBeInstanceOf(OpenAiWhisperEngine);
  });

  it("selects Groq Whisper via GROQ_API_KEY or explicit selection", () => {
    const auto = getTranscriptionEngine({ GROQ_API_KEY: "gsk-test" });
    expect(auto).toBeInstanceOf(OpenAiWhisperEngine);
    expect(auto.name).toBe("groq-whisper");

    const explicit = getTranscriptionEngine({
      CAPTIONFORGE_STT_ENGINE: "groq",
      GROQ_API_KEY: "gsk-test",
    });
    expect(explicit.name).toBe("groq-whisper");

    // OpenAI wins when both keys are present and nothing is selected.
    const both = getTranscriptionEngine({
      OPENAI_API_KEY: "sk-test",
      GROQ_API_KEY: "gsk-test",
    });
    expect(both.name).toBe("openai-whisper");
  });

  it("rejects openai/groq selection without the matching key", () => {
    expect(() =>
      getTranscriptionEngine({ CAPTIONFORGE_STT_ENGINE: "openai" })
    ).toThrow(TranscriptionNotConfiguredError);
    expect(() =>
      getTranscriptionEngine({ CAPTIONFORGE_STT_ENGINE: "groq" })
    ).toThrow(TranscriptionNotConfiguredError);
  });

  it("rejects unknown engines and empty configuration", () => {
    expect(() =>
      getTranscriptionEngine({ CAPTIONFORGE_STT_ENGINE: "deepgram" })
    ).toThrow(TranscriptionNotConfiguredError);
    expect(() => getTranscriptionEngine({})).toThrow(
      TranscriptionNotConfiguredError
    );
  });
});

describe("FakeTranscriptionEngine", () => {
  it("is deterministic and paces words inside the audio duration", async () => {
    const engine = new FakeTranscriptionEngine();
    const a = await engine.transcribe({ audioPath: "/na", durationSeconds: 5 });
    const b = await engine.transcribe({ audioPath: "/na", durationSeconds: 5 });
    expect(a).toEqual(b);
    expect(a.words.length).toBeGreaterThan(3);
    for (const w of a.words) {
      expect(w.startSeconds).toBeLessThan(w.endSeconds);
      expect(w.endSeconds).toBeLessThanOrEqual(5);
    }
  });

  it("yields at least one word for very short audio", async () => {
    const engine = new FakeTranscriptionEngine();
    const t = await engine.transcribe({ audioPath: "/na", durationSeconds: 0.05 });
    expect(t.words.length).toBe(1);
  });
});
