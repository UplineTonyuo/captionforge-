import * as React from "react";

import {
  BASE_TEXT_COLOR,
  CAPTION_FONT_FAMILY,
  CAPTION_ROLES,
  captionFontSize,
  DEFAULT_CAPTION_STYLE,
  EMPHASIS_OVERLAP_RATIO,
  HIGHLIGHT_ENTRANCE,
  HIGHLIGHT_EXTRUDE,
  HIGHLIGHT_SHADOW,
  LINE_HEIGHT,
  OUTLINE_COLOR,
  OUTLINE_RATIO,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  SHADOW,
  THIN_ENTRANCE,
  WORD_GAP_RATIO,
} from "@/lib/captions/style";
import { getActiveSegment, pickEmphasisIndex } from "@/lib/captions/timing";
import type {
  CaptionSegment,
  CaptionStyle,
  CaptionWord,
} from "@/lib/video/types";

/**
 * Renders the PrimeClip caption style (PROJECT_SPEC.md §5) for one point in
 * time, absolutely positioned over a video frame.
 *
 * Layout per §5.1/§5.3: stacked — the segment's words before the emphasis
 * word wrap above it, the emphasis word (manual override, else the longest
 * word) sits alone on its own line in italic Inter 700 at the highlight size
 * and the highlight color, and the following words wrap below. Words accumulate as spoken:
 * each becomes visible at its own start time and fades in with blur; the
 * emphasis word additionally rises from below (§5.3.1). Every animation is
 * a pure function of `t − word.start`, so the browser preview and the
 * server-side export are frame-identical.
 *
 * This component is the visual source of truth for captions: the Remotion
 * composition renders it for both the preview Player and the export. Plain
 * React + inline styles, all constants from src/lib/captions/style.ts.
 */
export interface CaptionRendererProps {
  segments: CaptionSegment[];
  /** Playback position in seconds; drives visibility and animation. */
  currentTimeSeconds: number;
  /** Rendered frame dimensions in px; all sizing derives from these. */
  frameWidth: number;
  frameHeight: number;
  style?: CaptionStyle;
}

/** Cubic ease-out of an entrance `elapsed` seconds in, over `durationSeconds`. */
function entranceEase(elapsedSeconds: number, durationSeconds: number): number {
  const p = Math.min(1, Math.max(0, elapsedSeconds / durationSeconds));
  return 1 - (1 - p) ** 3;
}

export function CaptionRenderer({
  segments,
  currentTimeSeconds,
  frameWidth,
  frameHeight,
  style = DEFAULT_CAPTION_STYLE,
}: CaptionRendererProps) {
  const segment = getActiveSegment(segments, currentTimeSeconds);
  if (!segment) return null;

  const baseFontSize = captionFontSize("thin", style.sizePreset, frameHeight);
  const strokeWidth = 2 * OUTLINE_RATIO * baseFontSize;
  const shadow = `${SHADOW.offsetXRatio * baseFontSize}px ${
    SHADOW.offsetYRatio * baseFontSize
  }px ${SHADOW.blurRatio * baseFontSize}px ${SHADOW.color}`;

  const textBase: React.CSSProperties = {
    fontFamily: CAPTION_FONT_FAMILY,
    fontWeight: CAPTION_ROLES.thin.weight,
    lineHeight: LINE_HEIGHT,
    ...(strokeWidth > 0
      ? {
          WebkitTextStroke: `${strokeWidth}px ${OUTLINE_COLOR}`,
          paintOrder: "stroke fill" as const,
        }
      : {}),
    textShadow: shadow,
    whiteSpace: "pre",
  };

  const vertical: React.CSSProperties =
    style.position === "top"
      ? { top: SAFE_MARGIN_BOTTOM * frameHeight, alignItems: "flex-start" }
      : style.position === "center"
        ? { top: 0, bottom: 0, alignItems: "center" }
        : { bottom: SAFE_MARGIN_BOTTOM * frameHeight, alignItems: "flex-end" };

  const pop = pickEmphasisIndex(segment.words);
  const before = pop >= 0 ? segment.words.slice(0, pop) : segment.words;
  const after = pop >= 0 ? segment.words.slice(pop + 1) : [];
  const popWord = pop >= 0 ? segment.words[pop] : null;

  /** Visible from its own start time (§5.1 word reveal). */
  const isVisible = (word: CaptionWord) =>
    currentTimeSeconds >= word.startSeconds;

  const wordEntrance = (word: CaptionWord) =>
    entranceEase(currentTimeSeconds - word.startSeconds, THIN_ENTRANCE.seconds);

  const wordRow = (words: CaptionWord[], key: string) => {
    const visible = words.filter(isVisible);
    if (visible.length === 0) return null;
    return (
      <p
        key={key}
        style={{
          margin: 0,
          // Below the highlight line so it can never cover its descenders (§5.1).
          position: "relative",
          zIndex: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: WORD_GAP_RATIO * baseFontSize,
          textAlign: "center",
          fontSize: baseFontSize,
          color: BASE_TEXT_COLOR,
          ...textBase,
        }}
      >
        {visible.map((word, i) => {
          const eased = wordEntrance(word);
          const blurPx = (1 - eased) * THIN_ENTRANCE.blurRatio * baseFontSize;
          return (
            <span
              key={`${key}-${i}`}
              style={{
                display: "inline-block",
                opacity: eased,
                filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
              }}
            >
              {word.word}
            </span>
          );
        })}
      </p>
    );
  };

  const popEased =
    popWord && isVisible(popWord)
      ? entranceEase(
          currentTimeSeconds - popWord.startSeconds,
          HIGHLIGHT_ENTRANCE.seconds
        )
      : 0;
  const popFontSize = captionFontSize("highlight", style.sizePreset, frameHeight);
  const popBlurPx = (1 - popEased) * HIGHLIGHT_ENTRANCE.blurRatio * popFontSize;
  const popRisePx = (1 - popEased) * HIGHLIGHT_ENTRANCE.riseRatio * popFontSize;
  const popOverlapPx = EMPHASIS_OVERLAP_RATIO * popFontSize;

  // §5.3 depth: crisp un-blurred copies stepped straight DOWN under the fill so
  // the word reads as raised from the bottom (depth, not a glow), then a soft
  // shadow scaled to the highlight size deepest.
  const popShadow = [
    ...Array.from({ length: HIGHLIGHT_EXTRUDE.steps }, (_, i) => {
      const offset =
        ((i + 1) / HIGHLIGHT_EXTRUDE.steps) *
        HIGHLIGHT_EXTRUDE.offsetRatio *
        popFontSize;
      return `0 ${offset}px 0 ${HIGHLIGHT_EXTRUDE.color}`;
    }),
    `0 ${HIGHLIGHT_SHADOW.offsetYRatio * popFontSize}px ${
      HIGHLIGHT_SHADOW.blurRatio * popFontSize
    }px ${HIGHLIGHT_SHADOW.color}`,
  ].join(", ");

  // Backdrop scrim (§5.2): follows the segment's entrance fade so it never
  // pops; anchored to the caption edge, omitted for center position.
  const scrimEase = entranceEase(
    currentTimeSeconds - segment.startSeconds,
    THIN_ENTRANCE.seconds
  );
  const scrimEdge: React.CSSProperties | null =
    style.position === "bottom"
      ? { bottom: 0, backgroundImage: `linear-gradient(to top, rgba(0,0,0,${SCRIM.maxOpacity}), rgba(0,0,0,0))` }
      : style.position === "top"
        ? { top: 0, backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,${SCRIM.maxOpacity}), rgba(0,0,0,0))` }
        : null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {scrimEdge && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: SCRIM.heightRatio * frameHeight,
            opacity: scrimEase,
            ...scrimEdge,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: SAFE_MARGIN_X * frameWidth,
          right: SAFE_MARGIN_X * frameWidth,
          display: "flex",
          justifyContent: "center",
          ...vertical,
        }}
      >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {wordRow(before, `${segment.id}-before`)}
        {popWord && isVisible(popWord) && (
          <p
            style={{
              // Overlap the neighboring lines and stack above them (§5.1); the
              // raised z-index guarantees the line below never covers it.
              margin: `${-popOverlapPx}px 0`,
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              fontSize: popFontSize,
              color: style.highlightColor,
              opacity: popEased,
              filter: popBlurPx > 0.05 ? `blur(${popBlurPx}px)` : undefined,
              transform:
                popRisePx > 0.05 ? `translateY(${popRisePx}px)` : undefined,
              ...textBase,
              fontWeight: CAPTION_ROLES.highlight.weight,
              fontStyle: CAPTION_ROLES.highlight.italic ? "italic" : "normal",
              textShadow: popShadow,
            }}
          >
            {popWord.word}
          </p>
        )}
        {wordRow(after, `${segment.id}-after`)}
        </div>
      </div>
    </div>
  );
}
