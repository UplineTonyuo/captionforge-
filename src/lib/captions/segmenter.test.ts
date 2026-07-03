import { describe, expect, it } from "vitest";

import type { TranscriptWord } from "@/lib/video/types";
import {
  HANG_SECONDS,
  MAX_SEGMENT_SECONDS,
  MAX_SEGMENT_WORDS,
  MIN_SEGMENT_SECONDS,
  segmentWords,
} from "./segmenter";

/** Evenly paced words, `wordSeconds` each with `gapSeconds` between. */
function pacedWords(
  texts: string[],
  wordSeconds = 0.3,
  gapSeconds = 0.05
): TranscriptWord[] {
  let t = 0;
  return texts.map((word) => {
    const w = { word, startSeconds: t, endSeconds: t + wordSeconds };
    t = w.endSeconds + gapSeconds;
    return w;
  });
}

describe("segmentWords (PROJECT_SPEC.md §5.5)", () => {
  it("returns no segments for empty or zero-length input", () => {
    expect(segmentWords([])).toEqual([]);
    expect(
      segmentWords([{ word: "x", startSeconds: 1, endSeconds: 1 }])
    ).toEqual([]);
  });

  it("caps segments at 6 words", () => {
    // 0.3 s words: 6 words span ~2.05 s, under the 2.5 s cap, so the word
    // cap is what breaks the group.
    const segments = segmentWords(
      pacedWords("a b c d e f g h i".split(" "), 0.3)
    );
    for (const s of segments) {
      expect(s.words.length).toBeLessThanOrEqual(MAX_SEGMENT_WORDS);
    }
    expect(segments.map((s) => s.text)).toEqual(["a b c d e f", "g h i"]);
  });

  it("caps segment span at 2.5 s even with few words", () => {
    // 1 s per word: a third word would push the span past 2.5 s.
    const segments = segmentWords(pacedWords(["slow", "words", "here"], 1.0, 0.1));
    for (const s of segments) {
      const span =
        s.words[s.words.length - 1].endSeconds - s.words[0].startSeconds;
      expect(span).toBeLessThanOrEqual(MAX_SEGMENT_SECONDS + 1e-9);
    }
    expect(segments).toHaveLength(2);
  });

  it("breaks at punctuation", () => {
    // 0.4 s words: "Hi." meets the 350 ms minimum and stays its own segment.
    const segments = segmentWords(pacedWords(["Hi.", "there", "friend"], 0.4));
    expect(segments[0].text).toBe("Hi.");
    expect(segments[1].text).toBe("there friend");
  });

  it("lets the 350 ms minimum override the word cap and punctuation breaks", () => {
    // A short "Hi." merges forward even across its punctuation break (§5.5:
    // minimum display time wins).
    const segments = segmentWords(pacedWords(["Hi.", "there", "friend"], 0.2));
    expect(segments[0].words.length).toBeGreaterThan(1);
    expect(segments[0].text.startsWith("Hi.")).toBe(true);
  });

  it("merges segments shorter than 350 ms forward", () => {
    // "Hi." alone would be 0.1 s on screen — must merge with what follows.
    const words: TranscriptWord[] = [
      { word: "Hi.", startSeconds: 0, endSeconds: 0.1 },
      { word: "long", startSeconds: 0.15, endSeconds: 0.6 },
      { word: "enough", startSeconds: 0.6, endSeconds: 1.1 },
    ];
    const segments = segmentWords(words);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Hi. long enough");
  });

  it("merges a trailing short segment backward", () => {
    const words: TranscriptWord[] = [
      { word: "a", startSeconds: 0, endSeconds: 0.4 },
      { word: "b", startSeconds: 0.4, endSeconds: 0.8 },
      { word: "c", startSeconds: 0.8, endSeconds: 1.2 },
      { word: "d.", startSeconds: 1.2, endSeconds: 1.6 },
      { word: "tail", startSeconds: 1.65, endSeconds: 1.7 },
    ];
    const segments = segmentWords(words);
    const last = segments[segments.length - 1];
    expect(last.words.map((w) => w.word)).toContain("tail");
    expect(last.endSeconds - last.startSeconds).toBeGreaterThanOrEqual(
      MIN_SEGMENT_SECONDS
    );
  });

  it("adds 120 ms hang time, clamped to the next segment's start", () => {
    const words: TranscriptWord[] = [
      // Gap after first group is large: full hang applies.
      { word: "one.", startSeconds: 0, endSeconds: 0.5 },
      { word: "two.", startSeconds: 2.0, endSeconds: 2.5 },
      // Third group starts immediately: clamp.
      { word: "three", startSeconds: 2.55, endSeconds: 3.0 },
    ];
    const segments = segmentWords(words);
    expect(segments[0].endSeconds).toBeCloseTo(0.5 + HANG_SECONDS, 10);
    expect(segments[1].endSeconds).toBeCloseTo(2.55, 10); // clamped
    expect(segments[2].endSeconds).toBeCloseTo(3.0 + HANG_SECONDS, 10);
  });

  it("never produces overlapping segments and covers every word once", () => {
    const words = pacedWords(
      "the quick brown fox, jumps over the lazy dog. and then runs far away tonight".split(
        " "
      ),
      0.22,
      0.03
    );
    const segments = segmentWords(words);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startSeconds).toBeGreaterThanOrEqual(
        segments[i - 1].endSeconds - 1e-9
      );
    }
    const covered = segments.flatMap((s) => s.words.map((w) => w.word));
    expect(covered).toEqual(words.map((w) => w.word));
  });

  it("derives text from words and assigns stable ids", () => {
    const segments = segmentWords(pacedWords(["hello", "world"]));
    expect(segments[0].id).toBe("seg-1");
    expect(segments[0].text).toBe("hello world");
  });
});
