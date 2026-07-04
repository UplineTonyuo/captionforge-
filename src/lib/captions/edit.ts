import type { CaptionSegment } from "@/lib/video/types";

/**
 * Transcript text editing (FR-4, text only). Correcting a word changes only its
 * text — the word's timestamps and every other word are preserved — so the
 * caption timing from transcription stays intact. Pure functions returning new
 * arrays; the caller holds the edited segments as the single source of truth
 * for both the preview and the export.
 *
 * Intentionally minimal: no insertion, deletion, split/merge, or re-timing.
 * Isomorphic: no Node built-ins, no DOM, no React.
 */

/** Deep-clone segments so edits never mutate the original transcript. */
export function cloneSegments(segments: CaptionSegment[]): CaptionSegment[] {
  return segments.map((segment) => ({
    ...segment,
    words: segment.words.map((word) => ({ ...word })),
  }));
}

/**
 * Replace the text of one word, preserving its `startSeconds`/`endSeconds` and
 * all other words. The segment's derived `text` is recomputed from its words.
 */
export function editWordText(
  segments: CaptionSegment[],
  segmentIndex: number,
  wordIndex: number,
  text: string
): CaptionSegment[] {
  return segments.map((segment, si) => {
    if (si !== segmentIndex) return segment;
    const words = segment.words.map((word, wi) =>
      wi === wordIndex ? { ...word, word: text } : word
    );
    return { ...segment, words, text: words.map((w) => w.word).join(" ") };
  });
}
