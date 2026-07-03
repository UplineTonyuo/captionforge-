import type { CaptionSegment, CaptionWord } from "@/lib/video/types";

/**
 * Pure timing queries over caption segments (PROJECT_SPEC.md §5.5).
 * Isomorphic: no Node built-ins, no DOM, no React.
 */

/**
 * The segment visible at time `t`, or null. Segments never overlap (§5.5), so
 * the first match is the only match. Visibility interval is [start, end).
 */
export function getActiveSegment(
  segments: CaptionSegment[],
  timeSeconds: number
): CaptionSegment | null {
  return (
    segments.find(
      (s) => timeSeconds >= s.startSeconds && timeSeconds < s.endSeconds
    ) ?? null
  );
}

/**
 * Whether `word` is the currently spoken (karaoke-active) word at time `t`.
 * Active for exactly the word's [start, end) interval (§5.3).
 */
export function isWordActive(word: CaptionWord, timeSeconds: number): boolean {
  return timeSeconds >= word.startSeconds && timeSeconds < word.endSeconds;
}

/**
 * Whether `word` should render emphasized at time `t`: karaoke-active, or
 * manually marked (§5.3, §5.6 per-word overrides).
 */
export function isWordEmphasized(
  word: CaptionWord,
  timeSeconds: number
): boolean {
  return word.emphasized === true || isWordActive(word, timeSeconds);
}

/**
 * The one word per segment that renders in the highlight color (§5.3
 * Selection): a manual override wins; otherwise the longest word, ties going
 * to the later word. Fixed for the segment's whole visible duration.
 */
export function pickEmphasisIndex(words: CaptionWord[]): number {
  const manual = words.findIndex((w) => w.emphasized === true);
  if (manual >= 0) return manual;
  let index = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i].word.length >= words[index].word.length) index = i;
  }
  return words.length > 0 ? index : -1;
}

/** Total duration covered by a caption track: end of the last segment. */
export function captionTrackEnd(segments: CaptionSegment[]): number {
  return segments.reduce((max, s) => Math.max(max, s.endSeconds), 0);
}

/**
 * Wrap `t` into the caption track's duration so a short demo track can loop
 * over a longer video. Returns `t` unchanged for an empty track.
 */
export function loopTime(segments: CaptionSegment[], timeSeconds: number): number {
  const end = captionTrackEnd(segments);
  return end > 0 ? timeSeconds % end : timeSeconds;
}
