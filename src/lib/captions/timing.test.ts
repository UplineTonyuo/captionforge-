import { describe, expect, it } from "vitest";

import { segmentFromWords } from "./demo";
import {
  captionTrackEnd,
  getActiveSegment,
  isWordActive,
  isWordEmphasized,
  loopTime,
  pickEmphasisIndex,
} from "./timing";

const segments = [
  segmentFromWords("s1", [
    ["hello", 0.0, 0.4],
    ["there", 0.4, 0.9],
  ]),
  segmentFromWords("s2", [
    ["general", 1.1, 1.6],
    ["kenobi", 1.6, 2.4, true],
  ]),
];

describe("getActiveSegment", () => {
  it("returns the segment covering t, with [start, end) semantics", () => {
    expect(getActiveSegment(segments, 0.0)?.id).toBe("s1");
    expect(getActiveSegment(segments, 0.89)?.id).toBe("s1");
    expect(getActiveSegment(segments, 0.9)).toBeNull(); // s1 end is exclusive
    expect(getActiveSegment(segments, 1.1)?.id).toBe("s2");
  });

  it("returns null in gaps, before the first and after the last segment", () => {
    expect(getActiveSegment(segments, 1.0)).toBeNull();
    expect(getActiveSegment(segments, -0.1)).toBeNull();
    expect(getActiveSegment(segments, 99)).toBeNull();
    expect(getActiveSegment([], 0)).toBeNull();
  });
});

describe("isWordActive / isWordEmphasized", () => {
  const word = { word: "there", startSeconds: 0.4, endSeconds: 0.9 };

  it("is active exactly for [start, end)", () => {
    expect(isWordActive(word, 0.39)).toBe(false);
    expect(isWordActive(word, 0.4)).toBe(true);
    expect(isWordActive(word, 0.89)).toBe(true);
    expect(isWordActive(word, 0.9)).toBe(false);
  });

  it("manual emphasis wins even when the word is not active", () => {
    const manual = { ...word, emphasized: true };
    expect(isWordEmphasized(manual, 0.0)).toBe(true);
    expect(isWordEmphasized(word, 0.0)).toBe(false);
    expect(isWordEmphasized(word, 0.5)).toBe(true);
  });
});

describe("pickEmphasisIndex (§5.3 Selection)", () => {
  const w = (word: string, emphasized?: boolean) => ({
    word,
    startSeconds: 0,
    endSeconds: 1,
    ...(emphasized ? { emphasized } : {}),
  });

  it("prefers a manually emphasized word", () => {
    expect(pickEmphasisIndex([w("longestword"), w("hi", true)])).toBe(1);
  });

  it("falls back to the longest word", () => {
    expect(pickEmphasisIndex([w("in"), w("definition"), w("of")])).toBe(1);
  });

  it("breaks ties toward the later word", () => {
    expect(pickEmphasisIndex([w("abc"), w("def"), w("gh")])).toBe(1);
  });

  it("handles single-word segments and empty input", () => {
    expect(pickEmphasisIndex([w("solo")])).toBe(0);
    expect(pickEmphasisIndex([])).toBe(-1);
  });
});

describe("captionTrackEnd / loopTime", () => {
  it("reports the end of the last segment", () => {
    expect(captionTrackEnd(segments)).toBe(2.4);
    expect(captionTrackEnd([])).toBe(0);
  });

  it("wraps time into the track duration", () => {
    expect(loopTime(segments, 0.5)).toBe(0.5);
    expect(loopTime(segments, 2.4)).toBe(0);
    expect(loopTime(segments, 2.9)).toBeCloseTo(0.5, 10);
    expect(loopTime([], 7)).toBe(7); // empty track passes time through
  });
});

describe("segmentFromWords", () => {
  it("derives segment bounds and text from its words", () => {
    const s = segments[1];
    expect(s.startSeconds).toBe(1.1);
    expect(s.endSeconds).toBe(2.4);
    expect(s.text).toBe("general kenobi");
    expect(s.words[1].emphasized).toBe(true);
    expect(s.words[0].emphasized).toBeUndefined();
  });
});
