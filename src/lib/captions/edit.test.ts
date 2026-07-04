import { describe, expect, it } from "vitest";

import { parseSegments } from "@/lib/rendering/validate";
import type { CaptionSegment } from "@/lib/video/types";
import { cloneSegments, editWordText } from "./edit";

function fixture(): CaptionSegment[] {
  return [
    {
      id: "seg-1",
      startSeconds: 0,
      endSeconds: 1.0,
      words: [
        { word: "helo", startSeconds: 0, endSeconds: 0.4 },
        { word: "wrld", startSeconds: 0.4, endSeconds: 1.0 },
      ],
      text: "helo wrld",
    },
    {
      id: "seg-2",
      startSeconds: 1.2,
      endSeconds: 1.8,
      words: [{ word: "friends", startSeconds: 1.2, endSeconds: 1.8 }],
      text: "friends",
    },
  ];
}

describe("editWordText", () => {
  it("corrects a word's text while preserving its timestamps", () => {
    const original = fixture();
    const edited = editWordText(original, 0, 0, "hello");

    const word = edited[0].words[0];
    expect(word.word).toBe("hello");
    // Timestamps are untouched.
    expect(word.startSeconds).toBe(0);
    expect(word.endSeconds).toBe(0.4);
    // Segment start/end unchanged.
    expect(edited[0].startSeconds).toBe(0);
    expect(edited[0].endSeconds).toBe(1.0);
  });

  it("recomputes the segment's derived text from its words", () => {
    const edited = editWordText(editWordText(fixture(), 0, 0, "hello"), 0, 1, "world");
    expect(edited[0].text).toBe("hello world");
  });

  it("leaves other words and other segments unchanged", () => {
    const edited = editWordText(fixture(), 0, 0, "hello");
    expect(edited[0].words[1]).toEqual({
      word: "wrld",
      startSeconds: 0.4,
      endSeconds: 1.0,
    });
    expect(edited[1]).toEqual(fixture()[1]);
  });

  it("does not mutate the input", () => {
    const original = fixture();
    editWordText(original, 0, 0, "hello");
    expect(original[0].words[0].word).toBe("helo");
    expect(original[0].text).toBe("helo wrld");
  });

  it("the edited text survives the render payload validation the export uses", () => {
    const edited = editWordText(fixture(), 0, 0, "hello");
    // startExport sends JSON.stringify(edited) to POST /api/render, which runs
    // parseSegments — the exported MP4 uses exactly this text/timing.
    const parsed = parseSegments(JSON.stringify(edited));
    expect(parsed[0].words[0].word).toBe("hello");
    expect(parsed[0].words[0].startSeconds).toBe(0);
    expect(parsed[0].words[0].endSeconds).toBe(0.4);
    expect(parsed[0].text).toBe("hello wrld");
  });
});

describe("cloneSegments", () => {
  it("produces an independent deep copy (reset-to-original safety)", () => {
    const original = fixture();
    const clone = cloneSegments(original);
    clone[0].words[0].word = "changed";
    expect(original[0].words[0].word).toBe("helo");
  });
});
