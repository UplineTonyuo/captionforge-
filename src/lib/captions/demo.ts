import type { CaptionSegment, CaptionWord } from "@/lib/video/types";

/**
 * Static demo caption track used by the preview page until transcription
 * (TASKS.md M2) produces real word timestamps. Content mirrors the PrimeClip
 * reference frame from PROJECT_SPEC.md §5.
 * Isomorphic: no Node built-ins, no DOM, no React.
 */

/** Build a CaptionSegment from (word, start, end, emphasized?) tuples. */
export function segmentFromWords(
  id: string,
  words: Array<[string, number, number] | [string, number, number, boolean]>
): CaptionSegment {
  const captionWords: CaptionWord[] = words.map(
    ([word, startSeconds, endSeconds, emphasized]) => ({
      word,
      startSeconds,
      endSeconds,
      ...(emphasized ? { emphasized } : {}),
    })
  );
  return {
    id,
    startSeconds: captionWords[0].startSeconds,
    endSeconds: captionWords[captionWords.length - 1].endSeconds,
    words: captionWords,
    text: captionWords.map((w) => w.word).join(" "),
  };
}

export const DEMO_SEGMENTS: CaptionSegment[] = [
  segmentFromWords("demo-1", [
    ["If", 0.0, 0.22],
    ["I'm", 0.22, 0.48],
    ["going", 0.48, 0.85],
  ]),
  segmentFromWords("demo-2", [
    ["to", 0.85, 1.0],
    ["do", 1.0, 1.2],
    ["it", 1.2, 1.38],
    ["today", 1.38, 1.95],
  ]),
  segmentFromWords("demo-3", [
    ["I'll", 2.05, 2.3],
    ["do", 2.3, 2.5],
    ["it", 2.5, 2.68],
    ["tomorrow", 2.68, 3.6, true],
  ]),
  segmentFromWords("demo-4", [
    ["Greatness", 3.8, 4.35],
    ["is", 4.35, 4.55],
    ["forged", 4.55, 5.05, true],
  ]),
  segmentFromWords("demo-5", [
    ["through", 5.05, 5.4],
    ["discipline", 5.4, 6.2, true],
  ]),
];
