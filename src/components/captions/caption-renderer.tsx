import * as React from "react";

import {
  BASE_FONT_SIZE_BY_PRESET,
  BASE_TEXT_COLOR,
  DEFAULT_CAPTION_STYLE,
  EMPHASIS_EXTRUDE,
  EMPHASIS_ITALIC,
  EMPHASIS_OVERLAP_RATIO,
  EMPHASIS_RISE_RATIO,
  EMPHASIS_SCALE,
  ENTRANCE_BLUR_RATIO,
  ENTRANCE_SECONDS,
  FONT_FAMILY,
  FONT_WEIGHT,
  LINE_HEIGHT,
  OUTLINE_COLOR,
  OUTLINE_RATIO,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  SHADOW,
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
 * word) sits alone on its own line at 1.7× in italic and the highlight
 * color, and the following words wrap below. Words accumulate as spoken:
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

/** Cubic ease-out of a word's entrance at `elapsed` seconds after its start. */
function entranceEase(elapsedSeconds: number): number {
  const p = Math.min(1, Math.max(0, elapsedSeconds / ENTRANCE_SECONDS));
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

  const baseFontSize =
    BASE_FONT_SIZE_BY_PRESET[style.sizePreset] * frameHeight;
  const strokeWidth = 2 * OUTLINE_RATIO * baseFontSize;
  const shadow = `${SHADOW.offsetXRatio * baseFontSize}px ${
    SHADOW.offsetYRatio * baseFontSize
  }px ${SHADOW.blurRatio * baseFontSize}px ${SHADOW.color}`;

  const textBase: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHT,
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
    entranceEase(currentTimeSeconds - word.startSeconds);

  const wordRow = (words: CaptionWord[], key: string) => {
    const visible = words.filter(isVisible);
    if (visible.length === 0) return null;
    return (
      <p
        key={key}
        style={{
          margin: 0,
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
          const blurPx = (1 - eased) * ENTRANCE_BLUR_RATIO * baseFontSize;
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

  const popEased = popWord && isVisible(popWord) ? wordEntrance(popWord) : 0;
  const popFontSize = EMPHASIS_SCALE * baseFontSize;
  const popBlurPx = (1 - popEased) * ENTRANCE_BLUR_RATIO * popFontSize;
  const popRisePx = (1 - popEased) * EMPHASIS_RISE_RATIO * popFontSize;
  const popOverlapPx = EMPHASIS_OVERLAP_RATIO * popFontSize;

  // §5.3 "3D layer": hard un-blurred copies stepped down-right under the
  // fill, then the regular soft shadow (scaled to the emphasis size) deepest.
  const popShadow = [
    ...Array.from({ length: EMPHASIS_EXTRUDE.steps }, (_, i) => {
      const offset =
        ((i + 1) / EMPHASIS_EXTRUDE.steps) *
        EMPHASIS_EXTRUDE.offsetRatio *
        popFontSize;
      return `${offset}px ${offset}px 0 ${EMPHASIS_EXTRUDE.color}`;
    }),
    `${SHADOW.offsetXRatio * popFontSize}px ${
      SHADOW.offsetYRatio * popFontSize
    }px ${SHADOW.blurRatio * popFontSize}px ${SHADOW.color}`,
  ].join(", ");

  // Backdrop scrim (§5.2): follows the segment's entrance fade so it never
  // pops; anchored to the caption edge, omitted for center position.
  const scrimEase = entranceEase(
    currentTimeSeconds - segment.startSeconds
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
              // Overlap the neighboring lines and stack above them (§5.1).
              margin: `${-popOverlapPx}px 0`,
              position: "relative",
              zIndex: 1,
              textAlign: "center",
              fontSize: popFontSize,
              fontStyle: EMPHASIS_ITALIC ? "italic" : "normal",
              color: style.highlightColor,
              opacity: popEased,
              filter: popBlurPx > 0.05 ? `blur(${popBlurPx}px)` : undefined,
              transform:
                popRisePx > 0.05 ? `translateY(${popRisePx}px)` : undefined,
              ...textBase,
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
