import type { CaptionSegment, TranscriptWord } from "@/lib/video/types";

/**
 * Word-timestamps → caption segments, per PROJECT_SPEC.md §5.5:
 *   · group ≤ 6 words or ≤ 2.5 s per segment, breaking at punctuation
 *   · minimum 350 ms on screen — shorter segments merge forward
 *   · visible until last word end + 120 ms hang, clamped to the next
 *     segment's start; segments never overlap
 * Isomorphic: no Node built-ins, no DOM, no React.
 */

export const MAX_SEGMENT_SECONDS = 2.5;
export const MAX_SEGMENT_WORDS = 6;
export const MIN_SEGMENT_SECONDS = 0.35;
export const HANG_SECONDS = 0.12;

const BREAK_PUNCTUATION = /[.!?,;:]$/;

function endsSentenceChunk(word: TranscriptWord): boolean {
  return BREAK_PUNCTUATION.test(word.word);
}

export function segmentWords(words: TranscriptWord[]): CaptionSegment[] {
  const spoken = words.filter((w) => w.endSeconds > w.startSeconds);
  if (spoken.length === 0) return [];

  // Pass 1 — group words (§5.5 grouping rules).
  const groups: TranscriptWord[][] = [];
  let current: TranscriptWord[] = [];
  for (const word of spoken) {
    if (current.length > 0) {
      const wouldSpan = word.endSeconds - current[0].startSeconds;
      if (current.length >= MAX_SEGMENT_WORDS || wouldSpan > MAX_SEGMENT_SECONDS) {
        groups.push(current);
        current = [];
      }
    }
    current.push(word);
    if (endsSentenceChunk(word)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  // Pass 2 — enforce minimum display time by merging short groups forward.
  const merged: TranscriptWord[][] = [];
  for (let i = 0; i < groups.length; i++) {
    let group = groups[i];
    while (
      i < groups.length - 1 &&
      spanSeconds(group) < MIN_SEGMENT_SECONDS
    ) {
      group = [...group, ...groups[i + 1]];
      i++;
    }
    merged.push(group);
  }
  // A trailing short group merges backward into its predecessor.
  if (
    merged.length > 1 &&
    spanSeconds(merged[merged.length - 1]) < MIN_SEGMENT_SECONDS
  ) {
    const tail = merged.pop() as TranscriptWord[];
    merged[merged.length - 1] = [...merged[merged.length - 1], ...tail];
  }

  // Pass 3 — visibility windows: +hang, clamped to the next segment's start.
  return merged.map((group, i) => {
    const startSeconds = group[0].startSeconds;
    const lastWordEnd = group[group.length - 1].endSeconds;
    const nextStart =
      i < merged.length - 1 ? merged[i + 1][0].startSeconds : Infinity;
    const endSeconds = Math.min(lastWordEnd + HANG_SECONDS, nextStart);
    return {
      id: `seg-${i + 1}`,
      startSeconds,
      endSeconds,
      words: group.map((w) => ({ ...w })),
      text: group.map((w) => w.word).join(" "),
    };
  });
}

function spanSeconds(group: TranscriptWord[]): number {
  return group[group.length - 1].endSeconds - group[0].startSeconds;
}
